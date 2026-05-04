"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 State สำหรับจัดทีม A และ B แบบ Manual
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);

  // State สำหรับเลือกลงคอร์ด (10 คอร์ด)
  const [selectedCourt, setSelectedCourt] = useState<number>(1);
  const courts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const [showResultModal, setShowResultModal] = useState(false);
  const [matchToFinish, setMatchToFinish] = useState<any[]>([]); 

  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('admin_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchData = async () => {
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    if (session) {
      // ใช้ select('*') เพื่อดึงข้อมูลทั้งหมด รวมถึงคอลัมน์ team (ถ้าสร้างไว้แล้ว)
      const { data } = await supabase
        .from("session_participants")
        .select(`*, profiles!profile_id(display_name, avatar_url, elo_rating)`)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true }) 
        .order("join_time", { ascending: true }); 
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

  // 🤖 ฟังก์ชัน AI คำนวณคู่ที่สูสีที่สุด
  const getBestPairing = (fourPlayers: any[]) => {
    if (!fourPlayers || fourPlayers.length !== 4) return null;
    const p = fourPlayers;
    const getElo = (player: any) => player.profiles?.elo_rating || 1200;

    const diff1 = Math.abs((getElo(p[0]) + getElo(p[1])) - (getElo(p[2]) + getElo(p[3])));
    const diff2 = Math.abs((getElo(p[0]) + getElo(p[2])) - (getElo(p[1]) + getElo(p[3])));
    const diff3 = Math.abs((getElo(p[0]) + getElo(p[3])) - (getElo(p[1]) + getElo(p[2])));

    const minDiff = Math.min(diff1, diff2, diff3);
    // 🌟 เติม , diff: minDiff กลับเข้าไป เพื่อให้ระบบเช็กค่าความต่าง ELO ได้
    if (minDiff === diff1) return { teamA: [p[0], p[1]], teamB: [p[2], p[3]], diff: minDiff };
    if (minDiff === diff2) return { teamA: [p[0], p[2]], teamB: [p[1], p[3]], diff: minDiff };
    return { teamA: [p[0], p[3]], teamB: [p[1], p[2]], diff: minDiff };
  };

  const handleAutoMatch = () => {
    const waitingList = participants.filter(p => p.queue_status === 'waiting');
    if (waitingList.length < 4) return alert("ต้องมีคนรอคิวอย่างน้อย 4 คนครับ!");
    
    const pool = waitingList.slice(0, 6); 
    
    let bestMatch: any = null;
    let minDiff = Infinity;

    if (pool.length === 4) {
      bestMatch = { ...getBestPairing(pool), players: pool };
    } else {
      for (let j = 1; j < pool.length - 2; j++) {
        for (let k = j + 1; k < pool.length - 1; k++) {
          for (let l = k + 1; l < pool.length; l++) {
            const candidates = [pool[0], pool[j], pool[k], pool[l]]; 
            const pairing = getBestPairing(candidates);
            
            // 🌟 เติม pairing && ตรงนี้ เพื่อกันเหนียวในกรณีที่ pairing เป็น null ครับ
            if (pairing && pairing.diff < minDiff) {
              minDiff = pairing.diff;
              bestMatch = { ...pairing, players: candidates };
            }
          }
        }
      }
    }

    if (bestMatch) {
      setTeamA(bestMatch.teamA.map((p: any) => p.id));
      setTeamB(bestMatch.teamB.map((p: any) => p.id));
    }
  };

  // 🌟 ฟังก์ชันเลือกลงทีมแบบ Manual
  const toggleSelect = (id: string) => {
    if (teamA.includes(id)) {
      setTeamA(teamA.filter(item => item !== id));
    } else if (teamB.includes(id)) {
      setTeamB(teamB.filter(item => item !== id));
    } else if (teamA.length < 2) {
      setTeamA([...teamA, id]);
    } else if (teamB.length < 2) {
      setTeamB([...teamB, id]);
    } else {
      alert("เลือกครบ 4 คนแล้วครับ (ทีมละ 2 คน)");
    }
  };

  const handlePrepareMatch = async () => {
    const totalSelected = teamA.length + teamB.length;
    if (totalSelected !== 4) return alert("ต้องเลือกผู้เล่นให้ครบ 4 คนครับ!");
    setLoading(true);
    
    // ลองเซฟแบบมี column 'team' ก่อน
    const { error: teamAError } = await supabase.from("session_participants").update({ queue_status: 'preparing', court_number: selectedCourt, team: 'A' }).in('id', teamA);
    const { error: teamBError } = await supabase.from("session_participants").update({ queue_status: 'preparing', court_number: selectedCourt, team: 'B' }).in('id', teamB);
    
    // ถ้าขึ้น Error แปลว่ายังไม่ได้สร้าง Column 'team' ให้ใช้คำสั่งแบบเดิม (ไม่ระบุทีม) เพื่อกันระบบพัง
    if (teamAError || teamBError) {
      await supabase.from("session_participants").update({ queue_status: 'preparing', court_number: selectedCourt }).in('id', [...teamA, ...teamB]);
      console.warn("⚠️ คุณยังไม่ได้เพิ่มคอลัมน์ 'team' (text) ใน Supabase ครับ ระบบจึงใช้ AI จัดทีมให้ชั่วคราว");
    }

    setTeamA([]);
    setTeamB([]);
    fetchData();
  };

  const handleStartMatch = async (courtNum: number) => {
    setLoading(true);
    const playersInCourt = participants.filter(p => p.queue_status === 'preparing' && p.court_number === courtNum);
    const idsToStart = playersInCourt.map(p => p.id);
    await supabase.from("session_participants").update({ queue_status: 'playing' }).in('id', idsToStart);
    fetchData();
  };

  const handleOpenResultModal = (courtNum: number) => {
    const courtParticipants = participants.filter(p => p.queue_status === 'playing' && p.court_number === courtNum);
    setMatchToFinish(courtParticipants);
    setShowResultModal(true); 
  };

  const handleForceClearCourt = async (status: string, courtNum: number) => {
    if (!confirm(`ต้องการดึงผู้เล่นในคอร์ด ${courtNum} กลับมารอคิวใช่หรือไม่? (จะไม่คิดคะแนน ELO)`)) return;
    setLoading(true);
    
    const playersInCourt = participants.filter(p => p.queue_status === status && p.court_number === courtNum);
    const idsToClear = playersInCourt.map(p => p.id);

    if (idsToClear.length > 0) {
      await supabase.from("session_participants").update({ queue_status: 'waiting', court_number: null, team: null }).in('id', idsToClear);
      fetchData();
    }
    setLoading(false);
  };

  const confirmMatchResult = async (resultType: 'teamA' | 'teamB' | 'draw') => {
    setShowResultModal(false); 
    setLoading(true);

    // ดึงทีมจากฐานข้อมูล หรือ ใช้ AI จัดคู่ถ้าไม่มี
    let winners: any[] = [];
    let isDraw = false;
    
    const tA = matchToFinish.filter(p => p.team === 'A');
    const tB = matchToFinish.filter(p => p.team === 'B');
    const hasManualTeams = tA.length > 0 && tB.length > 0;
    
    const pairing = hasManualTeams ? { teamA: tA, teamB: tB } : getBestPairing(matchToFinish);

    if (resultType === 'teamA') winners = pairing?.teamA || [];
    else if (resultType === 'teamB') winners = pairing?.teamB || [];
    else isDraw = true;

    for (const p of matchToFinish) {
      const isWinner = winners.some(w => w.id === p.id);
      const currentElo = p.profiles?.elo_rating || 1200;
      let newElo = currentElo;
      
      if (!isDraw) newElo = isWinner ? currentElo + 15 : Math.max(0, currentElo - 10);

      await supabase.from("session_participants").update({
          queue_status: 'waiting',
          court_number: null,
          team: null, // เคลียร์ทีม
          games_played_today: p.games_played_today + 1,
          accumulated_shuttle_fee: (p.accumulated_shuttle_fee || 0) + 27,
          join_time: new Date().toISOString(),
          wins: (p.wins || 0) + (!isDraw && isWinner ? 1 : 0),
          losses: (p.losses || 0) + (!isDraw && !isWinner ? 1 : 0),
          draws: (p.draws || 0) + (isDraw ? 1 : 0)
        }).eq('id', p.id);

      if (p.profile_id) {
        await supabase.from("profiles").update({ elo_rating: newElo }).eq('id', p.profile_id);
      }
    }

    alert(isDraw ? "⚖️ เสมอกัน! (ไม่หัก/ไม่เพิ่ม ELO)" : `🏆 ทีม ${resultType === 'teamA' ? '1 (ฟ้า)' : '2 (ส้ม)'} ชนะ! (บวก 15 แต้ม)`);
    fetchData();
    setLoading(false);
  };

  if (loading && participants.length === 0) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400 font-bold text-xl">กำลังโหลดระบบแอดมิน...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const preparing = participants.filter(p => p.queue_status === 'preparing');
  const playing = participants.filter(p => p.queue_status === 'playing');

  // จัดทีมใน Modal
  let modalPairing: any = null;
  if (showResultModal && matchToFinish.length === 4) {
    const tA = matchToFinish.filter(p => p.team === 'A');
    const tB = matchToFinish.filter(p => p.team === 'B');
    modalPairing = (tA.length > 0 && tB.length > 0) ? { teamA: tA, teamB: tB } : getBestPairing(matchToFinish);
  }

  // 🌟 Component แยกเรนเดอร์ทีมแบบ VS 
  const RenderMatchPairing = ({ players }: { players: any[] }) => {
    const tA = players.filter(p => p.team === 'A');
    const tB = players.filter(p => p.team === 'B');
    const match = (tA.length > 0 && tB.length > 0) ? { teamA: tA, teamB: tB } : getBestPairing(players);

    if (!match || match.teamA.length === 0) {
      return (
        <div className="space-y-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-xl shadow-sm border border-gray-700">
              <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=random`} className="w-7 h-7 rounded-full object-cover border border-gray-600" alt="profile" />
              <p className="font-semibold text-gray-200 text-sm truncate">{p.profiles?.display_name}</p>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="relative flex flex-col gap-2">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-2">
          <p className="text-[10px] font-black text-blue-400 mb-1.5 uppercase px-1">🟦 ทีม 1</p>
          <div className="space-y-1.5">
            {match.teamA.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800/80 p-1.5 rounded-lg border border-gray-700">
                <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=3B82F6&color=fff`} className="w-6 h-6 rounded-full object-cover" alt="profile" />
                <p className="font-bold text-gray-200 text-sm truncate">{p.profiles?.display_name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-gray-900 border border-gray-700 shadow-sm rounded-full px-2 py-0.5">
          <span className="text-[10px] font-black text-gray-400 italic">VS</span>
        </div>

        <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-2">
          <p className="text-[10px] font-black text-orange-400 mb-1.5 uppercase px-1 text-right">ทีม 2 🟧</p>
          <div className="space-y-1.5">
            {match.teamB.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800/80 p-1.5 rounded-lg flex-row-reverse text-right border border-gray-700">
                <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=F97316&color=fff`} className="w-6 h-6 rounded-full object-cover" alt="profile" />
                <p className="font-bold text-gray-200 text-sm truncate">{p.profiles?.display_name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 font-sans relative">
      
      {/* 🌟 Modal สรุปผล (Dark Gray Minimal) */}
      {modalPairing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-800">
            <h3 className="text-2xl font-extrabold text-center text-yellow-400 mb-6">🎮 สรุปผลการแข่งขัน</h3>
            
            <div className="space-y-4">
              <button onClick={() => confirmMatchResult('teamA')} className="w-full bg-blue-900/20 border border-blue-500/50 hover:bg-blue-900/40 text-left p-4 rounded-2xl transition flex flex-col items-center">
                <span className="text-blue-400 font-bold mb-1">🏆 ทีม 1 (ฟ้า) ชนะ (+15 ELO)</span>
                <span className="text-gray-300 text-sm text-center">{modalPairing.teamA[0].profiles.display_name} & {modalPairing.teamA[1].profiles.display_name}</span>
              </button>

              <button onClick={() => confirmMatchResult('draw')} className="w-full bg-gray-800 border border-gray-700 hover:bg-gray-700 p-4 rounded-2xl transition font-bold text-gray-300">
                ⚖️ เสมอกัน 1-1 เซ็ต (ELO คงเดิม)
              </button>

              <button onClick={() => confirmMatchResult('teamB')} className="w-full bg-orange-900/20 border border-orange-500/50 hover:bg-orange-900/40 text-left p-4 rounded-2xl transition flex flex-col items-center">
                <span className="text-orange-400 font-bold mb-1">🏆 ทีม 2 (ส้ม) ชนะ (+15 ELO)</span>
                <span className="text-gray-300 text-sm text-center">{modalPairing.teamB[0].profiles.display_name} & {modalPairing.teamB[1].profiles.display_name}</span>
              </button>
            </div>

            <button onClick={() => setShowResultModal(false)} className="mt-6 w-full text-gray-500 hover:text-gray-300 font-semibold py-2 transition">
              ยกเลิก (ยังไม่จบเกม)
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* 🌟 Header & Menu */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-800 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-gray-100 flex items-center gap-2">
            <span className="text-yellow-500">👑</span> ระบบจัดการก๊วน (แอดมิน)
          </h1>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link href="/admin/settings" className="bg-gray-800 border border-gray-700 text-gray-300 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              ⚙️ ตั้งค่าก๊วน
            </Link>
            <Link href="/admin/payments" className="bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-500 transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              💰 ตรวจสลิป
            </Link>
            <Link href="/leaderboard" className="bg-yellow-500 text-gray-900 font-bold px-4 py-2.5 rounded-xl hover:bg-yellow-400 transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏆 ตารางคะแนน
            </Link>
            <Link href="/queue" className="bg-gray-800 border border-gray-700 text-gray-300 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-700 transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              กระดานผู้เล่น
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* 🌟 ฝั่งซ้าย: โซนรอคิว และส่งลงคอร์ด */}
          <div className="bg-gray-900 rounded-3xl p-5 md:p-6 shadow-xl border border-gray-800 lg:col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-100">จัดคนลงสนาม ({teamA.length + teamB.length}/4)</h2>
            </div>
            
            {/* 🌟 ปุ่มเครื่องมือจัดทีม */}
            <div className="grid grid-cols-3 gap-2 mb-5">
               <button onClick={handleAutoMatch} className="col-span-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 py-2 rounded-xl font-bold hover:bg-indigo-600/40 transition text-xs md:text-sm">
                  🤖 ELO
               </button>
               <button onClick={() => { setTeamA(teamB); setTeamB(teamA); }} className="col-span-1 bg-gray-800 text-gray-300 border border-gray-700 py-2 rounded-xl font-bold hover:bg-gray-700 transition text-xs md:text-sm">
                  🔄 สลับฝั่ง
               </button>
               <button onClick={() => { setTeamA([]); setTeamB([]); }} className="col-span-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 py-2 rounded-xl font-bold hover:bg-rose-500/20 transition text-xs md:text-sm">
                  🧹 ล้าง
               </button>
            </div>

            <div className="mb-5 flex flex-col gap-3">
              <select 
                value={selectedCourt} 
                onChange={(e) => setSelectedCourt(Number(e.target.value))}
                className="bg-gray-950 text-gray-200 border border-gray-700 rounded-xl p-3.5 font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500 w-full transition"
              >
                {courts.map(c => <option key={c} value={c}>📍 เลือกลงคอร์ดที่ {c}</option>)}
              </select>
              
              <button 
                onClick={handlePrepareMatch}
                disabled={teamA.length + teamB.length !== 4}
                className={`w-full py-3.5 rounded-xl font-bold transition shadow-md ${(teamA.length + teamB.length) === 4 ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900 animate-pulse' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
              >
                ส่งไปเตรียมตัว คอร์ด {selectedCourt}
              </button>
            </div>
            
            <p className="text-[10px] text-gray-500 mb-2 text-center uppercase tracking-widest">คลิกเพื่อจับลงทีม 1 หรือ ทีม 2</p>

            <div className="space-y-2 h-[400px] md:h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {waiting.length === 0 ? <p className="text-gray-500 text-center py-8">ไม่มีคนรอคิว</p> : 
                waiting.map((p) => {
                  const isTeamA = teamA.includes(p.id);
                  const isTeamB = teamB.includes(p.id);
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border 
                        ${isTeamA ? 'bg-blue-900/20 border-blue-500' : isTeamB ? 'bg-orange-900/20 border-orange-500' : 'bg-gray-950 border-gray-800 hover:border-gray-600'}`}
                    >
                      <div className="flex items-center gap-3 w-full min-w-0">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover border border-gray-700 flex-shrink-0" alt="profile" />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm md:text-base truncate ${isTeamA ? 'text-blue-400' : isTeamB ? 'text-orange-400' : 'text-gray-200'}`}>{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                          <p className="text-xs text-gray-500 truncate">ตีไป: {p.games_played_today} | ELO: {p.profiles.elo_rating}</p>
                        </div>
                      </div>
                      {isTeamA && <span className="font-black text-blue-400 text-xs bg-blue-500/20 px-2 py-1 rounded-lg">ทีม 1</span>}
                      {isTeamB && <span className="font-black text-orange-400 text-xs bg-orange-500/20 px-2 py-1 rounded-lg">ทีม 2</span>}
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* 🌟 ฝั่งขวา: โซนแสดงคอร์ดต่างๆ */}
          <div className="bg-gray-900 rounded-3xl p-5 md:p-6 shadow-xl border border-gray-800 lg:col-span-2">
            <h2 className="text-lg md:text-xl font-bold text-gray-100 mb-6">แผงควบคุมคอร์ดปัจจุบัน</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courts.map(courtNum => {
                const preps = preparing.filter(p => p.court_number === courtNum);
                const plays = playing.filter(p => p.court_number === courtNum);
                
                if (preps.length === 0 && plays.length === 0) return null; 

                return (
                  <div key={courtNum} className="bg-gray-950 rounded-2xl p-4 border border-gray-800 shadow-inner">
                    <h3 className="font-extrabold text-base md:text-lg mb-3 text-yellow-500 border-b border-gray-800 pb-2">📍 คอร์ด {courtNum}</h3>
                    
                    {/* กำลังเตรียมตัว */}
                    {preps.length > 0 && (
                      <div className="mb-4">
                        <span className="text-xs md:text-sm font-bold text-gray-300 bg-gray-800 px-2 py-1 rounded-md border border-gray-700">🎽 เตรียมลงสนาม ({preps.length}/4)</span>
                        <div className="mt-3">
                          <RenderMatchPairing players={preps} />
                        </div>
                        {preps.length === 4 ? (
                          <button onClick={() => handleStartMatch(courtNum)} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3 rounded-xl shadow-md transition">
                            ▶️ ให้เริ่มตี
                          </button>
                        ) : (
                          <button onClick={() => handleForceClearCourt('preparing', courtNum)} className="mt-4 w-full bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-bold py-2.5 rounded-xl transition">
                            🔙 ดึงกลับมารอคิว (คนไม่ครบ)
                          </button>
                        )}
                      </div>
                    )}

                    {/* กำลังตีอยู่ */}
                    {plays.length > 0 && (
                      <div>
                        <span className="text-xs md:text-sm font-bold text-red-400 bg-red-900/20 px-2 py-1 rounded-md border border-red-500/30 flex items-center gap-1.5 w-fit">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                          กำลังตีอยู่ ({plays.length}/4)
                        </span>
                        <div className="mt-3">
                          <RenderMatchPairing players={plays} />
                        </div>
                        {plays.length === 4 ? (
                          <button onClick={() => handleOpenResultModal(courtNum)} className="mt-4 w-full bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-3 rounded-xl shadow-md transition">
                            ⏹ จบเกม (รายงานผล)
                          </button>
                        ) : (
                          <button onClick={() => handleForceClearCourt('playing', courtNum)} className="mt-4 w-full bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-bold py-2.5 rounded-xl transition">
                            🔙 ดึงกลับมารอคิว (คนไม่ครบ)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {preparing.length === 0 && playing.length === 0 && (
                <div className="col-span-1 md:col-span-2 flex items-center justify-center py-16 bg-gray-900 rounded-2xl border border-dashed border-gray-800">
                  <p className="text-gray-500 font-medium text-sm md:text-base">คอร์ดยังว่างทั้งหมด จัดคนลงได้เลยครับ!</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
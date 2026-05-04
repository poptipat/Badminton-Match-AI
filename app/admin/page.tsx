"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 เพิ่ม State สำหรับเลือกลงคอร์ด
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
      const { data } = await supabase
        .from("session_participants")
        // 🌟 ดึง court_number และ accumulated_shuttle_fee เพิ่มเข้ามา
        .select(`id, profile_id, queue_status, games_played_today, wins, losses, draws, join_time, preferred_partner_id, court_number, accumulated_shuttle_fee, profiles!profile_id(display_name, avatar_url, elo_rating)`)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true }) 
        .order("join_time", { ascending: true }); 
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

  // 🛠️ เครื่องมือเดิม: ฟังก์ชันหาคู่ที่ดีที่สุด (คงไว้ 100%)
  const getBestPairing = (fourPlayers: any[]) => {
    const p = fourPlayers;
    const diff1 = Math.abs((p[0].profiles.elo_rating + p[1].profiles.elo_rating) - (p[2].profiles.elo_rating + p[3].profiles.elo_rating));
    const diff2 = Math.abs((p[0].profiles.elo_rating + p[2].profiles.elo_rating) - (p[1].profiles.elo_rating + p[3].profiles.elo_rating));
    const diff3 = Math.abs((p[0].profiles.elo_rating + p[3].profiles.elo_rating) - (p[1].profiles.elo_rating + p[2].profiles.elo_rating));

    const minDiff = Math.min(diff1, diff2, diff3);
    if (minDiff === diff1) return { teamA: [p[0], p[1]], teamB: [p[2], p[3]], diff: minDiff };
    if (minDiff === diff2) return { teamA: [p[0], p[2]], teamB: [p[1], p[3]], diff: minDiff };
    return { teamA: [p[0], p[3]], teamB: [p[1], p[2]], diff: minDiff };
  };

  // 🤖 เครื่องมือเดิม: ฟังก์ชัน Auto Match (คงไว้ 100%)
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
            
            if (pairing.diff < minDiff) {
              minDiff = pairing.diff;
              bestMatch = { ...pairing, players: candidates };
            }
          }
        }
      }
    }

    if (bestMatch) {
      const message = `
        🤖 สุ่มจับคู่สำเร็จจากคิวแรกสุด! (ความต่าง ELO: ${bestMatch.diff}แต้ม)
        -----------------------------
        ทีม A (avg. ${(bestMatch.teamA[0].profiles.elo_rating + bestMatch.teamA[1].profiles.elo_rating) / 2}): ${bestMatch.teamA[0].profiles.display_name} + ${bestMatch.teamA[1].profiles.display_name}
        ทีม B (avg. ${(bestMatch.teamB[0].profiles.elo_rating + bestMatch.teamB[1].profiles.elo_rating) / 2}): ${bestMatch.teamB[0].profiles.display_name} + ${bestMatch.teamB[1].profiles.display_name}
      `;
      alert(message);
      setSelectedIds(bestMatch.players.map((p: any) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      if (selectedIds.length < 4) setSelectedIds([...selectedIds, id]);
    }
  };

  // 🌟 ฟังก์ชันใหม่ 1: ส่งคนไป "เตรียมตัว" คอร์ดที่เลือก
  const handlePrepareMatch = async () => {
    if (selectedIds.length !== 4) return alert("ต้องเลือกผู้เล่นให้ครบ 4 คนครับ!");
    setLoading(true);
    await supabase.from("session_participants")
      .update({ queue_status: 'preparing', court_number: selectedCourt })
      .in('id', selectedIds);
    setSelectedIds([]);
    setLoading(false);
  };

  // 🌟 ฟังก์ชันใหม่ 2: เปลี่ยนจาก "เตรียมตัว" เป็น "เริ่มตี" ตามเบอร์คอร์ด
  const handleStartMatch = async (courtNum: number) => {
    setLoading(true);
    const playersInCourt = participants.filter(p => p.queue_status === 'preparing' && p.court_number === courtNum);
    const idsToStart = playersInCourt.map(p => p.id);
    await supabase.from("session_participants")
      .update({ queue_status: 'playing' })
      .in('id', idsToStart);
    setLoading(false);
  };

  // 🌟 ฟังก์ชันใหม่ 3: กดเปิด Modal จบเกมเฉพาะคอร์ดนั้นๆ
  const handleOpenResultModal = (courtNum: number) => {
    const courtParticipants = participants.filter(p => p.queue_status === 'playing' && p.court_number === courtNum);
    setMatchToFinish(courtParticipants);
    setShowResultModal(true); 
  };

  const confirmMatchResult = async (resultType: 'teamA' | 'teamB' | 'draw') => {
    setShowResultModal(false); 
    setLoading(true);

    const pairing = getBestPairing(matchToFinish);
    
    let winners: any[] = [];
    let isDraw = false;

    if (resultType === 'teamA') winners = pairing.teamA;
    else if (resultType === 'teamB') winners = pairing.teamB;
    else isDraw = true;

    for (const p of matchToFinish) {
      const isWinner = winners.some(w => w.id === p.id);
      const currentElo = p.profiles?.elo_rating || 1200;
      
      let newElo = currentElo;
      if (!isDraw) {
        newElo = isWinner ? currentElo + 15 : Math.max(0, currentElo - 10);
      }

      await supabase
        .from("session_participants")
        .update({
          queue_status: 'waiting',
          court_number: null, // 🌟 ล้างเบอร์คอร์ดทิ้ง
          games_played_today: p.games_played_today + 1,
          accumulated_shuttle_fee: (p.accumulated_shuttle_fee || 0) + 27,
          join_time: new Date().toISOString(),
          wins: (p.wins || 0) + (!isDraw && isWinner ? 1 : 0),
          losses: (p.losses || 0) + (!isDraw && !isWinner ? 1 : 0),
          draws: (p.draws || 0) + (isDraw ? 1 : 0)
        })
        .eq('id', p.id);

      if (p.profile_id) {
        await supabase
          .from("profiles")
          .update({ elo_rating: newElo })
          .eq('id', p.profile_id);
      }
    }

    let alertMsg = isDraw ? "⚖️ เสมอกัน! (ไม่หัก/ไม่เพิ่ม ELO)" : `🏆 ทีม ${resultType === 'teamA' ? 'A' : 'B'} ชนะ! (บวก 15 แต้ม)`;
    alert(`บันทึกผลเรียบร้อย: ${alertMsg}`);
    
    fetchData();
    setLoading(false);
  };

  if (loading && participants.length === 0) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">กำลังโหลดระบบแอดมิน...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const preparing = participants.filter(p => p.queue_status === 'preparing');
  const playing = participants.filter(p => p.queue_status === 'playing');

  let modalPairing: any = null;
  if (showResultModal && matchToFinish.length === 4) {
    modalPairing = getBestPairing(matchToFinish);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans relative">
      {/* 🌟 Modal สรุปผลแบบเดิมของคุณ สวยงามเหมือนเดิมเป๊ะ 🌟 */}
      {modalPairing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-center text-yellow-400 mb-6">🎮 สรุปผลการแข่งขัน</h3>
            
            <div className="space-y-4">
              <button 
                onClick={() => confirmMatchResult('teamA')}
                className="w-full bg-blue-600/20 border border-blue-500 hover:bg-blue-600/40 text-left p-4 rounded-xl transition flex flex-col items-center"
              >
                <span className="text-blue-400 font-bold mb-1">🏆 ทีม A ชนะ (+15 ELO)</span>
                <span className="text-white text-sm">{modalPairing.teamA[0].profiles.display_name} & {modalPairing.teamA[1].profiles.display_name}</span>
              </button>

              <button 
                onClick={() => confirmMatchResult('draw')}
                className="w-full bg-gray-800 border border-gray-600 hover:bg-gray-700 p-4 rounded-xl transition font-bold text-gray-300"
              >
                ⚖️ เสมอกัน 1-1 เซ็ต (ELO คงเดิม)
              </button>

              <button 
                onClick={() => confirmMatchResult('teamB')}
                className="w-full bg-red-600/20 border border-red-500 hover:bg-red-600/40 text-left p-4 rounded-xl transition flex flex-col items-center"
              >
                <span className="text-red-400 font-bold mb-1">🏆 ทีม B ชนะ (+15 ELO)</span>
                <span className="text-white text-sm">{modalPairing.teamB[0].profiles.display_name} & {modalPairing.teamB[1].profiles.display_name}</span>
              </button>
            </div>

            <button 
              onClick={() => setShowResultModal(false)}
              className="mt-6 w-full text-gray-500 hover:text-white font-semibold py-2"
            >
              ยกเลิก (ยังไม่จบเกม)
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold text-yellow-400">👑 ระบบแอดมินจัดการก๊วน</h1>
          <div className="flex gap-3">
            <Link href="/admin/payments" className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-500 transition shadow-md">
              💰 ตรวจสลิปโอนเงิน
            </Link>
            <Link href="/leaderboard" className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-500 transition shadow-md">
              🏆 ตารางคะแนน
            </Link>
            <Link href="/queue" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
              ดูกระดานผู้เล่น
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* ฝั่งซ้าย: โซนรอคิว และส่งลงคอร์ด (คงปุ่ม AI ของคุณไว้) */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800 lg:col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-orange-400">จัดคนลงสนาม ({selectedIds.length}/4)</h2>
              {waiting.length >= 4 && selectedIds.length === 0 && (
                  <button onClick={handleAutoMatch} className="bg-gray-700 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-gray-600 text-sm">
                      🤖 จัดคู่ ELO
                  </button>
              )}
            </div>

            {/* 🌟 กล่องเลือกคอร์ด */}
            <div className="mb-4 flex flex-col gap-2">
              <select 
                value={selectedCourt} 
                onChange={(e) => setSelectedCourt(Number(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg p-3 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 w-full"
              >
                {courts.map(c => <option key={c} value={c}>📍 เลือกลงคอร์ดที่ {c}</option>)}
              </select>
              
              <button 
                onClick={handlePrepareMatch}
                disabled={selectedIds.length !== 4}
                className={`w-full py-3 rounded-xl font-bold transition shadow-md ${selectedIds.length === 4 ? 'bg-orange-500 hover:bg-orange-400 text-white animate-pulse' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              >
                ส่งไปเตรียมตัว คอร์ด {selectedCourt}
              </button>
            </div>
            
            <div className="space-y-2 h-[500px] overflow-y-auto pr-2">
              {waiting.length === 0 ? <p className="text-gray-600 text-center py-4">ไม่มีคนรอคิว</p> : 
                waiting.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition border ${isSelected ? 'bg-orange-900/50 border-orange-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                    >
                      <div className="flex items-center gap-3 w-full min-w-0">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover bg-white flex-shrink-0" alt="profile" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                          <p className={`text-xs ${isSelected ? 'text-orange-300' : 'text-gray-400'}`}>ตีไป: {p.games_played_today} | ELO: {p.profiles.elo_rating}</p>
                        </div>
                      </div>
                      {isSelected && <span className="font-bold text-orange-400 text-lg ml-2">✓</span>}
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* ฝั่งขวา: โซนแสดงคอร์ดต่างๆ (เตรียมตัว & กำลังตี) */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800 lg:col-span-2">
            <h2 className="text-xl font-bold text-green-400 mb-6">สถานะคอร์ดปัจจุบัน</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {courts.map(courtNum => {
                const preps = preparing.filter(p => p.court_number === courtNum);
                const plays = playing.filter(p => p.court_number === courtNum);
                
                if (preps.length === 0 && plays.length === 0) return null; // ซ่อนคอร์ดที่ว่าง

                return (
                  <div key={courtNum} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="font-bold text-lg mb-3 text-white border-b border-gray-700 pb-2">📍 คอร์ด {courtNum}</h3>
                    
                    {/* กำลังเตรียมตัว */}
                    {preps.length > 0 && (
                      <div className="mb-4">
                        <span className="text-sm font-bold text-blue-400">🎽 เตรียมตัวลงสนาม ({preps.length}/4)</span>
                        <div className="mt-2 space-y-2">
                          {preps.map(p => (
                            <div key={p.id} className="flex items-center gap-2 bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-900/50">
                              <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-6 h-6 rounded-full object-cover bg-white flex-shrink-0" alt="profile" />
                              <span className="text-sm text-gray-200 truncate">{p.profiles?.display_name}</span>
                            </div>
                          ))}
                        </div>
                        {preps.length === 4 && (
                          <button onClick={() => handleStartMatch(courtNum)} className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-lg shadow-md">
                            ▶️ ให้เริ่มตี
                          </button>
                        )}
                      </div>
                    )}

                    {/* กำลังตีอยู่ */}
                    {plays.length > 0 && (
                      <div>
                        <span className="text-sm font-bold text-green-400">🏸 กำลังตีอยู่ ({plays.length}/4)</span>
                        <div className="mt-2 space-y-2">
                          {plays.map(p => (
                            <div key={p.id} className="flex items-center gap-2 bg-green-900/20 px-3 py-2 rounded-lg border border-green-900/50">
                              <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-6 h-6 rounded-full object-cover bg-white flex-shrink-0" alt="profile" />
                              <span className="text-sm text-gray-200 truncate">{p.profiles?.display_name}</span>
                            </div>
                          ))}
                        </div>
                        {plays.length === 4 && (
                          <button onClick={() => handleOpenResultModal(courtNum)} className="mt-3 w-full bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-2.5 rounded-lg shadow-md">
                            ⏹ จบเกม (รายงานผล)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {preparing.length === 0 && playing.length === 0 && (
                <div className="col-span-full text-center text-gray-600 py-10 bg-gray-800/50 rounded-xl border border-gray-700/50">
                  คอร์ดยังว่างทั้งหมด จัดคนลงได้เลยครับ!
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
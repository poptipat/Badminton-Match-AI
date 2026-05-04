"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 State สำหรับเลือกลงคอร์ด (10 คอร์ด)
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
        .select(`id, profile_id, queue_status, games_played_today, wins, losses, draws, join_time, preferred_partner_id, court_number, accumulated_shuttle_fee, profiles!profile_id(display_name, avatar_url, elo_rating)`)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true }) 
        .order("join_time", { ascending: true }); 
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

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
        ทีม A: ${bestMatch.teamA[0].profiles.display_name} + ${bestMatch.teamA[1].profiles.display_name}
        ทีม B: ${bestMatch.teamB[0].profiles.display_name} + ${bestMatch.teamB[1].profiles.display_name}
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

  const handlePrepareMatch = async () => {
    if (selectedIds.length !== 4) return alert("ต้องเลือกผู้เล่นให้ครบ 4 คนครับ!");
    setLoading(true);
    await supabase.from("session_participants")
      .update({ queue_status: 'preparing', court_number: selectedCourt })
      .in('id', selectedIds);
    setSelectedIds([]);
    setLoading(false);
  };

  const handleStartMatch = async (courtNum: number) => {
    setLoading(true);
    const playersInCourt = participants.filter(p => p.queue_status === 'preparing' && p.court_number === courtNum);
    const idsToStart = playersInCourt.map(p => p.id);
    await supabase.from("session_participants")
      .update({ queue_status: 'playing' })
      .in('id', idsToStart);
    setLoading(false);
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
      const { error } = await supabase.from("session_participants")
        .update({ queue_status: 'waiting', court_number: null })
        .in('id', idsToClear);
        
      if (error) {
        alert("เกิดข้อผิดพลาดในการดึงกลับ: " + error.message);
      } else {
        fetchData();
      }
    }
    setLoading(false);
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

      await supabase.from("session_participants")
        .update({
          queue_status: 'waiting',
          court_number: null,
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

    let alertMsg = isDraw ? "⚖️ เสมอกัน! (ไม่หัก/ไม่เพิ่ม ELO)" : `🏆 ทีม ${resultType === 'teamA' ? 'A' : 'B'} ชนะ! (บวก 15 แต้ม)`;
    alert(`บันทึกผลเรียบร้อย: ${alertMsg}`);
    
    fetchData();
    setLoading(false);
  };

  if (loading && participants.length === 0) return <div className="min-h-screen flex items-center justify-center bg-[#013C58] text-[#FFBA42] font-bold text-xl">กำลังโหลดระบบแอดมิน...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const preparing = participants.filter(p => p.queue_status === 'preparing');
  const playing = participants.filter(p => p.queue_status === 'playing');

  let modalPairing: any = null;
  if (showResultModal && matchToFinish.length === 4) {
    modalPairing = getBestPairing(matchToFinish);
  }

  return (
    <div className="min-h-screen bg-[#013C58] text-white p-4 md:p-6 font-sans relative">
      
      {/* 🌟 Modal สรุปผล (Admin Dark Style) */}
      {modalPairing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#00537A] rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-[#A8E8F9]/30">
            <h3 className="text-2xl font-extrabold text-center text-[#FFBA42] mb-6">🎮 สรุปผลการแข่งขัน</h3>
            
            <div className="space-y-4">
              <button onClick={() => confirmMatchResult('teamA')} className="w-full bg-[#013C58] border-2 border-[#A8E8F9] hover:bg-[#A8E8F9]/20 text-left p-4 rounded-2xl transition flex flex-col items-center group shadow-md">
                <span className="text-[#A8E8F9] font-bold mb-1 group-hover:scale-105 transition-transform">🏆 ทีม A ชนะ (+15 ELO)</span>
                <span className="text-white text-sm text-center">{modalPairing.teamA[0].profiles.display_name} & {modalPairing.teamA[1].profiles.display_name}</span>
              </button>

              <button onClick={() => confirmMatchResult('draw')} className="w-full bg-[#013C58]/50 border border-[#A8E8F9]/30 hover:bg-[#013C58] p-4 rounded-2xl transition font-bold text-[#A8E8F9]">
                ⚖️ เสมอกัน 1-1 เซ็ต (ELO คงเดิม)
              </button>

              <button onClick={() => confirmMatchResult('teamB')} className="w-full bg-[#013C58] border-2 border-[#F5A201] hover:bg-[#F5A201]/20 text-left p-4 rounded-2xl transition flex flex-col items-center group shadow-md">
                <span className="text-[#F5A201] font-bold mb-1 group-hover:scale-105 transition-transform">🏆 ทีม B ชนะ (+15 ELO)</span>
                <span className="text-white text-sm text-center">{modalPairing.teamB[0].profiles.display_name} & {modalPairing.teamB[1].profiles.display_name}</span>
              </button>
            </div>

            <button onClick={() => setShowResultModal(false)} className="mt-6 w-full text-[#A8E8F9]/60 hover:text-[#A8E8F9] font-semibold py-2">
              ยกเลิก (ยังไม่จบเกม)
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* 🌟 Header & Menu */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-[#00537A] pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-[#FFBA42] drop-shadow-md">👑 ระบบจัดการก๊วน (แอดมิน)</h1>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Link href="/admin/payments" className="bg-[#F5A201] text-[#013C58] font-bold px-4 py-2.5 rounded-xl hover:bg-[#FFBA42] transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              💰 ตรวจสลิป
            </Link>
            <Link href="/leaderboard" className="bg-[#FFBA42] text-[#013C58] font-bold px-4 py-2.5 rounded-xl hover:bg-[#FFD35B] transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏆 ตารางคะแนน
            </Link>
            <Link href="/queue" className="bg-[#00537A] border border-[#A8E8F9]/30 text-[#A8E8F9] font-bold px-4 py-2.5 rounded-xl hover:bg-[#00537A]/80 transition shadow-md text-sm md:text-base flex-1 text-center whitespace-nowrap">
              กระดานผู้เล่น
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* 🌟 ฝั่งซ้าย: โซนรอคิว และส่งลงคอร์ด */}
          <div className="bg-[#00537A]/40 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-xl border border-[#A8E8F9]/20 lg:col-span-1">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg md:text-xl font-bold text-[#FFD35B]">จัดคนลงสนาม ({selectedIds.length}/4)</h2>
              {waiting.length >= 4 && selectedIds.length === 0 && (
                  <button onClick={handleAutoMatch} className="bg-[#013C58] text-[#F5A201] border border-[#F5A201]/50 px-3 py-1.5 rounded-lg font-bold hover:bg-[#013C58]/80 transition text-xs md:text-sm whitespace-nowrap shadow-sm">
                      🤖 จัดคู่ ELO
                  </button>
              )}
            </div>

            <div className="mb-5 flex flex-col gap-3">
              <select 
                value={selectedCourt} 
                onChange={(e) => setSelectedCourt(Number(e.target.value))}
                className="bg-[#013C58] text-white border border-[#A8E8F9]/30 rounded-xl p-3.5 font-bold focus:outline-none focus:ring-2 focus:ring-[#FFBA42] w-full transition shadow-inner"
              >
                {courts.map(c => <option key={c} value={c}>📍 เลือกลงคอร์ดที่ {c}</option>)}
              </select>
              
              <button 
                onClick={handlePrepareMatch}
                disabled={selectedIds.length !== 4}
                className={`w-full py-3.5 rounded-xl font-bold transition shadow-md ${selectedIds.length === 4 ? 'bg-[#F5A201] hover:bg-[#FFBA42] text-[#013C58] animate-pulse' : 'bg-[#013C58]/50 text-[#A8E8F9]/50 cursor-not-allowed border border-[#013C58]'}`}
              >
                ส่งไปเตรียมตัว คอร์ด {selectedCourt}
              </button>
            </div>
            
            <div className="space-y-3 h-[400px] md:h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {waiting.length === 0 ? <p className="text-[#A8E8F9]/50 text-center py-8">ไม่มีคนรอคิว</p> : 
                waiting.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-[#F5A201]/20 border-[#F5A201] shadow-md ring-1 ring-[#F5A201]' : 'bg-[#013C58] border-[#A8E8F9]/10 hover:border-[#F5A201]/50 hover:shadow-sm'}`}
                    >
                      <div className="flex items-center gap-3 w-full min-w-0">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=fff`} className="w-10 h-10 rounded-full object-cover border border-[#A8E8F9]/30 flex-shrink-0" alt="profile" />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm md:text-base truncate ${isSelected ? 'text-[#FFD35B]' : 'text-white'}`}>{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                          <p className={`text-xs truncate ${isSelected ? 'text-[#FFD35B]/80' : 'text-[#A8E8F9]/70'}`}>ตีไป: {p.games_played_today} | ELO: {p.profiles.elo_rating}</p>
                        </div>
                      </div>
                      {isSelected && <span className="font-bold text-[#F5A201] text-lg ml-2 drop-shadow-md">✓</span>}
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* 🌟 ฝั่งขวา: โซนแสดงคอร์ดต่างๆ */}
          <div className="bg-[#00537A]/40 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-xl border border-[#A8E8F9]/20 lg:col-span-2">
            <h2 className="text-lg md:text-xl font-bold text-[#A8E8F9] mb-6">แผงควบคุมคอร์ดปัจจุบัน</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courts.map(courtNum => {
                const preps = preparing.filter(p => p.court_number === courtNum);
                const plays = playing.filter(p => p.court_number === courtNum);
                
                if (preps.length === 0 && plays.length === 0) return null; 

                return (
                  <div key={courtNum} className="bg-[#013C58] rounded-2xl p-5 border border-[#A8E8F9]/20 shadow-inner">
                    <h3 className="font-extrabold text-base md:text-lg mb-3 text-[#FFBA42] border-b border-[#00537A] pb-2">📍 คอร์ด {courtNum}</h3>
                    
                    {/* กำลังเตรียมตัว */}
                    {preps.length > 0 && (
                      <div className="mb-4">
                        <span className="text-xs md:text-sm font-bold text-[#A8E8F9] bg-[#00537A] px-2 py-1 rounded-md border border-[#A8E8F9]/30">🎽 เตรียมลงสนาม ({preps.length}/4)</span>
                        <div className="mt-3 space-y-2">
                          {preps.map(p => (
                            <div key={p.id} className="flex items-center gap-2 bg-[#00537A]/50 px-3 py-2 rounded-xl border border-[#A8E8F9]/10 shadow-sm">
                              <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=A8E8F9&color=013C58`} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="profile" />
                              <span className="text-sm text-white font-medium truncate">{p.profiles?.display_name}</span>
                            </div>
                          ))}
                        </div>
                        {preps.length === 4 ? (
                          <button onClick={() => handleStartMatch(courtNum)} className="mt-4 w-full bg-[#A8E8F9] hover:bg-white text-[#013C58] text-sm font-bold py-3 rounded-xl shadow-md transition">
                            ▶️ ให้เริ่มตี
                          </button>
                        ) : (
                          <button onClick={() => handleForceClearCourt('preparing', courtNum)} className="mt-4 w-full bg-[#013C58] border border-[#A8E8F9]/50 hover:bg-[#00537A] text-[#A8E8F9] text-sm font-bold py-2.5 rounded-xl transition">
                            🔙 ดึงกลับมารอคิว (คนไม่ครบ)
                          </button>
                        )}
                      </div>
                    )}

                    {/* กำลังตีอยู่ */}
                    {plays.length > 0 && (
                      <div>
                        <span className="text-xs md:text-sm font-bold text-[#F5A201] bg-[#F5A201]/20 px-2 py-1 rounded-md border border-[#F5A201]/30">🏸 กำลังตีอยู่ ({plays.length}/4)</span>
                        <div className="mt-3 space-y-2">
                          {plays.map(p => (
                            <div key={p.id} className="flex items-center gap-2 bg-[#00537A]/50 px-3 py-2 rounded-xl border border-[#F5A201]/20 shadow-sm">
                              <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=00537A&color=fff`} className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-[#F5A201]/50" alt="profile" />
                              <span className="text-sm text-white font-medium truncate">{p.profiles?.display_name}</span>
                            </div>
                          ))}
                        </div>
                        {plays.length === 4 ? (
                          <button onClick={() => handleOpenResultModal(courtNum)} className="mt-4 w-full bg-[#F5A201] hover:bg-[#FFBA42] text-[#013C58] text-sm font-bold py-3 rounded-xl shadow-md transition">
                            ⏹ จบเกม (รายงานผล)
                          </button>
                        ) : (
                          <button onClick={() => handleForceClearCourt('playing', courtNum)} className="mt-4 w-full bg-[#013C58] border border-[#A8E8F9]/50 hover:bg-[#00537A] text-[#A8E8F9] text-sm font-bold py-2.5 rounded-xl transition">
                            🔙 ดึงกลับมารอคิว (คนไม่ครบ)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {preparing.length === 0 && playing.length === 0 && (
                <div className="col-span-1 md:col-span-2 flex items-center justify-center py-16 bg-[#013C58]/50 rounded-2xl border border-dashed border-[#A8E8F9]/30">
                  <p className="text-[#A8E8F9]/70 font-medium text-sm md:text-base">คอร์ดยังว่างทั้งหมด จัดคนลงได้เลยครับ!</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select(`id, profile_id, queue_status, games_played_today, wins, losses, draws, join_time, preferred_partner_id, profiles!profile_id(display_name, avatar_url, elo_rating)`)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true }) 
        .order("join_time", { ascending: true }); 
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

  // 🛠️ เครื่องมือใหม่: ฟังก์ชันหาคู่ที่ดีที่สุด (ใช้ได้ทั้งตอนจัดทีม และตอนแสดงผล)
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
    
    const pool = waitingList.slice(0, 6); // พิจารณา 6 คนแรก
    
    let bestMatch: any = null;
    let minDiff = Infinity;

    if (pool.length === 4) {
      // ถ้ามีแค่ 4 คน ก็จัดเลย
      bestMatch = { ...getBestPairing(pool), players: pool };
    } else {
      // 🛠️ แก้ปัญหาข้ามคิว: AI จะค้นหา 4 คน โดย "บังคับให้คนที่อยู่คิวแรกสุด (pool[0]) ต้องได้ลงเสมอ!"
      for (let j = 1; j < pool.length - 2; j++) {
        for (let k = j + 1; k < pool.length - 1; k++) {
          for (let l = k + 1; l < pool.length; l++) {
            const candidates = [pool[0], pool[j], pool[k], pool[l]]; // บังคับใส่ pool[0] เข้าไปตลอด
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

  const handleStartMatch = async () => {
    if (selectedIds.length !== 4) return alert("ต้องเลือกผู้เล่นให้ครบ 4 คนครับ!");
    await supabase.from("session_participants").update({ queue_status: 'playing' }).in('id', selectedIds);
    alert("🏸 จัดคอร์ดสำเร็จ! ผู้เล่นลงสนามแล้ว");
    setSelectedIds([]);
    fetchData();
  };

  const handleOpenResultModal = (courtParticipants: any[]) => {
    setMatchToFinish(courtParticipants);
    setShowResultModal(true); 
  };

  const confirmMatchResult = async (resultType: 'teamA' | 'teamB' | 'draw') => {
    setShowResultModal(false); 
    setLoading(true);

    // 🛠️ แก้ปัญหา Modal สลับทีม: เรียกฟังก์ชันจัดทีมกลับมาอีกครั้ง เพื่อหาว่าใครคือทีม A และ B ที่แท้จริง
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
          games_played_today: p.games_played_today + 1,
          accumulated_shuttle_fee: (p.accumulated_shuttle_fee || 0) + 27,
          join_time: new Date().toISOString(),
          // 🌟 เติม 3 บรรทัดนี้ลงไป เพื่อบันทึกสถิติ 🌟
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">กำลังโหลดระบบแอดมิน...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const playing = participants.filter(p => p.queue_status === 'playing');

  // เตรียมข้อมูลทีมสำหรับ Modal
  let modalPairing: any = null;
  if (showResultModal && matchToFinish.length === 4) {
    modalPairing = getBestPairing(matchToFinish);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans relative">
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

      <div className="max-w-6xl mx-auto">
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

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-orange-400">จัดคนลงสนาม ({selectedIds.length}/4)</h2>
              <div className="flex gap-2">
                {waiting.length >= 4 && selectedIds.length === 0 && (
                    <button onClick={handleAutoMatch} className="bg-gray-700 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600 flex items-center gap-1.5">
                        🤖 จัดคู่ ELO
                    </button>
                )}
                {selectedIds.length === 4 && (
                    <button onClick={handleStartMatch} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-400 shadow-md animate-pulse">
                        เริ่มเกมเลย!
                    </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {waiting.length === 0 ? <p className="text-gray-600 text-center py-4">ไม่มีคนรอคิว</p> : 
                waiting.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition border ${isSelected ? 'bg-orange-600 border-orange-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover bg-white" alt="profile" />
                        <div>
                          <p className="font-semibold">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                          <p className={`text-xs ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>ตีไปแล้ว: {p.games_played_today} เกม | ELO: {p.profiles.elo_rating}</p>
                        </div>
                      </div>
                      {isSelected && <span className="font-bold text-lg">✓</span>}
                    </div>
                  );
                })
              }
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800">
            <h2 className="text-xl font-bold text-green-400 mb-6">กำลังตีอยู่ ({playing.length})</h2>
            <div className="space-y-3">
              {playing.length === 0 ? <p className="text-gray-600 text-center py-4">คอร์ดยังว่าง</p> : 
                playing.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
                    <div className="flex items-center gap-3">
                      <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover bg-white" alt="profile" />
                      <div>
                        <p className="font-semibold">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                        <p className="text-xs text-gray-400">สะสม: {p.accumulated_shuttle_fee} บ.</p>
                      </div>
                    </div>
                  </div>
                ))
              }
              
              {playing.length === 4 && (
                <button 
                  onClick={() => handleOpenResultModal(playing as any[])}
                  className="w-full mt-4 bg-red-600 text-white text-lg py-3 rounded-xl font-bold hover:bg-red-500 shadow-lg animate-pulse"
                >
                  จบเกม (รายงานผล)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // ตั้งค่า Real-time เพื่อให้แอดมินเห็นคิวอัปเดตทันที
    const subscription = supabase
      .channel('admin_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchData = async () => {
    // 1. หาก๊วนของวันนี้
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    if (session) {
      // 2. ดึงรายชื่อคนทั้งหมดในก๊วนนี้ พร้อมดึงคะแนน ELO มาด้วย!
      const { data } = await supabase
        .from("session_participants")
        .select(`id, queue_status, games_played_today, preferred_partner_id, profiles!profile_id(display_name, avatar_url, elo_rating)`)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true }) // เรียงให้คนตีน้อยได้คิวก่อน
        .order("join_time", { ascending: true }); // แล้วค่อยเรียงตามเวลาที่มาก่อน
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

  // --- ลอจิก Matchmaking แบบ ELO Rating ---
  const handleAutoMatch = () => {
    const waitingList = participants.filter(p => p.queue_status === 'waiting');
    if (waitingList.length < 4) return alert("ต้องมีคนรอคิวอย่างน้อย 4 คนครับ!");
    
    // 1. เลือก 4 คนแรกจากคิวมาคำนวณ
    const candidates = waitingList.slice(0, 4);
    
    // 2. จำลองการจัดทีม 3 รูปแบบที่เป็นไปได้
    const diff1 = Math.abs((candidates[0].profiles.elo_rating + candidates[1].profiles.elo_rating) - (candidates[2].profiles.elo_rating + candidates[3].profiles.elo_rating));
    const diff2 = Math.abs((candidates[0].profiles.elo_rating + candidates[2].profiles.elo_rating) - (candidates[1].profiles.elo_rating + candidates[3].profiles.elo_rating));
    const diff3 = Math.abs((candidates[0].profiles.elo_rating + candidates[3].profiles.elo_rating) - (candidates[1].profiles.elo_rating + candidates[2].profiles.elo_rating));

    // 3. หาความต่าง ELO ที่น้อยที่สุด (ทีมสูสีที่สุด)
    const minDiff = Math.min(diff1, diff2, diff3);
    
    let teamA = [], teamB = [];
    if (minDiff === diff1) { teamA = [candidates[0], candidates[1]]; teamB = [candidates[2], candidates[3]]; }
    else if (minDiff === diff2) { teamA = [candidates[0], candidates[2]]; teamB = [candidates[1], candidates[3]]; }
    else { teamA = [candidates[0], candidates[3]]; teamB = [candidates[1], candidates[2]]; }

    const message = `
      🤖 สุ่มจับคู่สำเร็จ (ความต่าง ELO: ${minDiff}แต้ม)
      -----------------------------
      ทีม A (avg. ${(teamA[0].profiles.elo_rating + teamA[1].profiles.elo_rating) / 2}): ${teamA[0].profiles.display_name} + ${teamA[1].profiles.display_name}
      ทีม B (avg. ${(teamB[0].profiles.elo_rating + teamB[1].profiles.elo_rating) / 2}): ${teamB[0].profiles.display_name} + ${teamB[1].profiles.display_name}
    `;
    alert(message);
    setSelectedIds(candidates.map(p => p.id)); // ติ๊กเลือกให้แอดมินทันที
  };

  // --- ระบบแมนนวล: ติ๊กเลือกคน ---
  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      if (selectedIds.length < 4) setSelectedIds([...selectedIds, id]);
    }
  };

  // --- ส่งคนลงสนาม ---
  const handleStartMatch = async () => {
    if (selectedIds.length !== 4) return alert("ต้องเลือกผู้เล่นให้ครบ 4 คนครับ!");
    
    // อัปเดตสถานะเป็น 'playing' ทีเดียว 4 คน
    await supabase.from("session_participants").update({ queue_status: 'playing' }).in('id', selectedIds);
      
    alert("🏸 จัดคอร์ดสำเร็จ! ผู้เล่นลงสนามแล้ว");
    setSelectedIds([]); // ล้างค่าที่เลือกไว้
    fetchData(); // โหลดข้อมูลใหม่
  };

  // --- จบเกม (นำคนกลับมารอคิว + บวกจำนวนเกม + บวกค่าลูกแบด 27 บาท) ---
  const handleFinishGame = async (player: any) => {
    const newGamesCount = (player.games_played_today || 0) + 1;
    const newShuttleFee = (player.accumulated_shuttle_fee || 0) + 27; 

    // อัปเดตข้อมูลกลับไปใน Database
    await supabase
      .from("session_participants")
      .update({ 
        queue_status: 'waiting',
        games_played_today: newGamesCount,
        accumulated_shuttle_fee: newShuttleFee
      })
      .eq('id', player.id);
      
    alert(`จบเกมของ ${player.profiles.display_name} เรียบร้อย! (รวม ${newGamesCount}เกม)`);
    fetchData();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">กำลังโหลดระบบแอดมิน...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const playing = participants.filter(p => p.queue_status === 'playing');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold text-yellow-400">👑 ระบบแอดมินจัดการก๊วน</h1>
          <div className="flex gap-3">
            <Link href="/admin/payments" className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-500 transition shadow-md">
              💰 ตรวจสลิปโอนเงิน
            </Link>
            <Link href="/queue" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
              ดูกระดานผู้เล่น
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* ฝั่งซ้าย: จัดคนลงสนาม */}
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

          {/* ฝั่งขวา: คนที่กำลังตีอยู่ (เพื่อกดจบเกม) */}
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
                    <button 
                      onClick={() => handleFinishGame(p)}
                      className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg font-bold hover:bg-red-500"
                    >
                      จบเกม
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
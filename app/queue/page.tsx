"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function QueueBoard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
    
    const subscription = supabase
      .channel('queue_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, fetchQueue)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchQueue = async () => {
    const { data: session } = await supabase
      .from("daily_sessions")
      .select("id")
      .eq("is_active", true)
      .single();

    if (session) {
      // 🌟 เพิ่ม court_number มารอไว้เลย (แม้ใน DB จะยังไม่มีก็ตาม ระบบจะไม่พังครับ)
      const { data: queueData, error } = await supabase
        .from("session_participants")
        .select(`
          id,
          queue_status,
          games_played_today,
          join_time,
          court_number,
          profiles!profile_id ( display_name, avatar_url )
        `)
        .eq("session_id", session.id)
        .order("games_played_today", { ascending: true })
        .order("join_time", { ascending: true });
      
      if (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      }
      
      setParticipants(queueData || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#013C58] text-[#FFBA42] font-bold text-xl">กำลังโหลดกระดานคิว...</div>;

  // 🌟 แยกกลุ่มสถานะออกเป็น 3 กลุ่ม
  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const playing = participants.filter(p => p.queue_status === 'playing');
  const preparing = participants.filter(p => p.queue_status === 'preparing');

  // จัดกลุ่มคนที่กำลังเตรียมตัว แยกตามเบอร์คอร์ด
  const preparingByCourt = preparing.reduce((acc, curr) => {
    const court = curr.court_number || 1; // ถ้ายังไม่มีเบอร์คอร์ด ให้ถือว่าเป็นคอร์ด 1 ไปก่อน
    if (!acc[court]) acc[court] = [];
    acc[court].push(curr);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="min-h-screen bg-[#013C58] p-4 md:p-6 font-sans text-white">
      <div className="max-w-6xl mx-auto">
        
        {/* 🌟 ส่วนหัวและปุ่ม (ปรับให้ Responsive กับมือถือ) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b border-[#00537A] pb-4">
          <h1 className="text-3xl font-extrabold text-[#FFBA42] drop-shadow-md">📋 กระดานจัดคิว</h1>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            
            {/* 🌟 ปุ่มแอดมิน (เดี๋ยวสเตปต่อไปเราจะเขียนระบบดักไว้ ให้เห็นเฉพาะคนที่ได้รับอนุญาต) */}
            <Link href="/admin" className="bg-[#F5A201] text-[#013C58] px-3 py-2 md:px-4 rounded-lg shadow-md hover:bg-[#FFBA42] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              👑 ระบบแอดมิน
            </Link>

            <Link href="/leaderboard" className="bg-[#FFBA42] text-[#013C58] px-3 py-2 md:px-4 rounded-lg shadow-md hover:bg-[#FFD35B] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏆 ตารางคะแนน
            </Link>

            <Link href="/profile" className="bg-[#00537A] text-[#A8E8F9] px-3 py-2 md:px-4 rounded-lg shadow-md hover:bg-[#00537A]/80 border border-[#00537A] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              👤 โปรไฟล์ของฉัน
            </Link>

            <Link href="/" className="bg-[#013C58] text-[#A8E8F9] px-3 py-2 md:px-4 rounded-lg shadow-md border border-[#00537A] hover:bg-[#00537A] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏠 กลับหน้าหลัก
            </Link>

          </div>
            
        </div>

        {/* 🌟 ตาราง 3 คอลัมน์: รอคิว -> เตรียมตัว -> ลงสนาม */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* คอลัมน์ที่ 1: คนที่กำลังรอตี */}
          <div className="bg-[#00537A]/30 backdrop-blur-md rounded-3xl shadow-xl border border-[#00537A] p-4 md:p-6">
            <h2 className="text-xl font-bold text-[#FFBA42] mb-4 flex items-center gap-2">
              <span className="bg-[#F5A201]/20 text-[#FFBA42] p-2 rounded-lg">⏳</span> รอคิว ({waiting.length})
            </h2>
            <div className="space-y-3">
              {waiting.length === 0 ? (
                <p className="text-[#A8E8F9]/50 text-center py-4 text-sm font-medium">ยังไม่มีคนรอคิว</p>
              ) : (
                waiting.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-[#013C58] rounded-xl border border-[#00537A] shadow-sm">
                    <div className="flex items-center gap-3 w-full">
                      <div className="font-bold text-[#A8E8F9] w-5 text-sm">{index + 1}.</div>
                      <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=013C58`} className="w-10 h-10 rounded-full object-cover border-2 border-[#A8E8F9]/30 flex-shrink-0" alt="profile" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                        <p className="text-xs text-[#A8E8F9]">ตีไปแล้ว: {p.games_played_today} เกม</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 2: คนที่ต้องเตรียมลงสนาม (แยกตามคอร์ด) */}
          <div className="bg-[#00537A]/30 backdrop-blur-md rounded-3xl shadow-xl border border-[#00537A] ring-2 ring-[#F5A201]/50 p-4 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F5A201] to-[#FFBA42]"></div>
            <h2 className="text-xl font-bold text-[#A8E8F9] mb-4 flex items-center gap-2">
              <span className="bg-[#013C58] text-[#A8E8F9] p-2 rounded-lg shadow-inner">🎽</span> เตรียมลงสนาม ({preparing.length})
            </h2>
            <div className="space-y-4">
              {preparing.length === 0 ? (
                <p className="text-[#A8E8F9]/50 text-center py-4 text-sm font-medium">ยังไม่มีคิวเตรียมลง</p>
              ) : (
                Object.keys(preparingByCourt).map((courtNum) => (
                  <div key={courtNum} className="bg-[#013C58] p-3 rounded-xl border border-[#00537A] shadow-inner">
                    <h3 className="font-bold text-[#FFD35B] text-sm mb-2 border-b border-[#00537A] pb-1">📍 เตรียมลงคอร์ดที่ {courtNum}</h3>
                    <div className="space-y-2">
                      {preparingByCourt[Number(courtNum)].map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 bg-[#00537A] rounded-lg shadow-sm border border-[#A8E8F9]/20">
                          <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=013C58`} className="w-8 h-8 rounded-full object-cover border border-[#A8E8F9]/30" alt="profile" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white text-sm truncate">{p.profiles?.display_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 3: คนที่กำลังตีอยู่ */}
          <div className="bg-[#00537A]/30 backdrop-blur-md rounded-3xl shadow-xl border border-[#00537A] p-4 md:p-6">
            <h2 className="text-xl font-bold text-[#FFD35B] mb-4 flex items-center gap-2">
              <span className="bg-[#F5A201]/20 text-[#FFD35B] p-2 rounded-lg">🏸</span> กำลังลงสนาม ({playing.length})
            </h2>
            <div className="space-y-3">
              {playing.length === 0 ? (
                <p className="text-[#A8E8F9]/50 text-center py-4 text-sm font-medium">คอร์ดยังว่าง</p>
              ) : (
                playing.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-[#F5A201]/10 rounded-xl border border-[#F5A201]/30 shadow-sm">
                    <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=013C58`} className="w-10 h-10 rounded-full object-cover border-2 border-[#F5A201]/50 flex-shrink-0" alt="profile" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                      <p className="text-xs text-[#FFBA42] font-medium animate-pulse">อยู่ในคอร์ด</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
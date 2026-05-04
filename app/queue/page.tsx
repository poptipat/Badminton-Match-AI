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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">กำลังโหลดกระดานคิว...</div>;

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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* 🌟 ส่วนหัวและปุ่ม (ปรับให้ Responsive กับมือถือ) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">📋 กระดานจัดคิว</h1>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Link href="/setup-profile" className="bg-green-600 text-white px-3 py-2 md:px-4 rounded-lg shadow-sm hover:bg-green-500 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              + ลงทะเบียนใหม่
            </Link>
            <Link href="/profile" className="bg-blue-600 text-white px-3 py-2 md:px-4 rounded-lg shadow-sm hover:bg-blue-500 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              👤 โปรไฟล์ของฉัน
            </Link>
            <Link href="/leaderboard" className="bg-yellow-500 text-white px-3 py-2 md:px-4 rounded-lg shadow-sm hover:bg-yellow-400 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏆 ทำเนียบ
            </Link>
            <Link href="/" className="bg-white text-gray-600 px-3 py-2 md:px-4 rounded-lg shadow-sm border hover:bg-gray-50 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏠 กลับหน้าหลัก
            </Link>
          </div>
        </div>

        {/* 🌟 ตาราง 3 คอลัมน์: รอคิว -> เตรียมตัว -> ลงสนาม */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* คอลัมน์ที่ 1: คนที่กำลังรอตี */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
            <h2 className="text-xl font-bold text-orange-500 mb-4 flex items-center gap-2">
              <span className="bg-orange-100 p-2 rounded-lg">⏳</span> รอคิว ({waiting.length})
            </h2>
            <div className="space-y-3">
              {waiting.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">ยังไม่มีคนรอคิว</p>
              ) : (
                waiting.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3 w-full">
                      <div className="font-bold text-gray-400 w-5 text-sm">{index + 1}.</div>
                      <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0" alt="profile" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                        <p className="text-xs text-gray-500">ตีไปแล้ว: {p.games_played_today} เกม</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 2: คนที่ต้องเตรียมลงสนาม (แยกตามคอร์ด) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 ring-2 ring-blue-100">
            <h2 className="text-xl font-bold text-blue-500 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 p-2 rounded-lg">🎽</span> เตรียมลงสนาม ({preparing.length})
            </h2>
            <div className="space-y-4">
              {preparing.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">ยังไม่มีคิวเตรียมลง</p>
              ) : (
                Object.keys(preparingByCourt).map((courtNum) => (
                  <div key={courtNum} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-blue-700 text-sm mb-2 border-b border-blue-200 pb-1">📍 เตรียมลงคอร์ดที่ {courtNum}</h3>
                    <div className="space-y-2">
                      {preparingByCourt[Number(courtNum)].map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 bg-white rounded-lg shadow-sm border border-blue-50">
                          <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-8 h-8 rounded-full object-cover" alt="profile" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-800 text-sm truncate">{p.profiles?.display_name}</p>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
            <h2 className="text-xl font-bold text-green-500 mb-4 flex items-center gap-2">
              <span className="bg-green-100 p-2 rounded-lg">🏸</span> กำลังลงสนาม ({playing.length})
            </h2>
            <div className="space-y-3">
              {playing.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">คอร์ดยังว่าง</p>
              ) : (
                playing.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0" alt="profile" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                      <p className="text-xs text-green-600 font-medium">อยู่ในคอร์ด</p>
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
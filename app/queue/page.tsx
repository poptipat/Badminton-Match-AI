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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังโหลดกระดานคิว...</div>;

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const playing = participants.filter(p => p.queue_status === 'playing');
  const preparing = participants.filter(p => p.queue_status === 'preparing');

  const preparingByCourt = preparing.reduce((acc, curr) => {
    const court = curr.court_number || 1; 
    if (!acc[court]) acc[court] = [];
    acc[court].push(curr);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* 🌟 Header & Menu (Minimalist CI) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58]">📋 กระดานจัดคิว</h1>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Link href="/admin" className="bg-[#00537A] text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#013C58] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              👑 ระบบแอดมิน
            </Link>
            <Link href="/leaderboard" className="bg-[#F5A201] text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#FFBA42] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏆 ตารางคะแนน
            </Link>
            <Link href="/profile" className="bg-white text-[#00537A] border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              👤 โปรไฟล์ของฉัน
            </Link>
            <Link href="/" className="bg-white text-slate-600 border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
              🏠 กลับหน้าหลัก
            </Link>
          </div>
        </div>

        {/* 🌟 ตาราง 3 คอลัมน์ (สไตล์การ์ดสีขาวสะอาดตา) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          
          {/* คอลัมน์ที่ 1: รอคิว */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6">
            <h2 className="text-xl font-bold text-[#F5A201] mb-5 flex items-center gap-2">
              <span className="bg-[#FFFBF0] text-[#F5A201] p-2 rounded-lg border border-[#F5A201]/20">⏳</span> รอคิว ({waiting.length})
            </h2>
            <div className="space-y-3">
              {waiting.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm font-medium">ยังไม่มีคนรอคิว</p>
              ) : (
                waiting.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 transition">
                    <div className="flex items-center gap-3 w-full">
                      <div className="font-bold text-slate-400 w-5 text-sm">{index + 1}.</div>
                      <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=fff`} className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0" alt="profile" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#013C58] truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                        <p className="text-xs text-slate-500">ตีไปแล้ว: {p.games_played_today} เกม</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 2: เตรียมลงสนาม */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#00537A]"></div>
            <h2 className="text-xl font-bold text-[#00537A] mb-5 flex items-center gap-2">
              <span className="bg-[#A8E8F9]/30 text-[#00537A] p-2 rounded-lg border border-[#A8E8F9]/50">🎽</span> เตรียมลงสนาม ({preparing.length})
            </h2>
            <div className="space-y-4">
              {preparing.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm font-medium">ยังไม่มีคิวเตรียมลง</p>
              ) : (
                Object.keys(preparingByCourt).map((courtNum) => (
                  <div key={courtNum} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h3 className="font-extrabold text-[#013C58] text-sm mb-3 border-b border-slate-200 pb-2">📍 เตรียมลงคอร์ดที่ {courtNum}</h3>
                    <div className="space-y-2">
                      {preparingByCourt[Number(courtNum)].map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                          <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=00537A&color=fff`} className="w-8 h-8 rounded-full object-cover border border-slate-100" alt="profile" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-700 text-sm truncate">{p.profiles?.display_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 3: กำลังลงสนาม */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6">
            <h2 className="text-xl font-bold text-[#013C58] mb-5 flex items-center gap-2">
              <span className="bg-[#00537A]/10 text-[#00537A] p-2 rounded-lg border border-[#00537A]/20">🏸</span> กำลังลงสนาม ({playing.length})
            </h2>
            <div className="space-y-3">
              {playing.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm font-medium">คอร์ดยังว่าง</p>
              ) : (
                playing.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3.5 bg-[#FFFBF0] rounded-2xl border border-[#F5A201]/30 shadow-sm">
                    <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=fff`} className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0" alt="profile" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#013C58] truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                      <p className="text-xs text-[#F5A201] font-bold animate-pulse mt-0.5">อยู่ในคอร์ด</p>
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
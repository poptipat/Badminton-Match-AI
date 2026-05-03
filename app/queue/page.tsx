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
      // 🌟 แก้ไขตรงนี้: เติม !profile_id เพื่อบอกให้ Supabase รู้ว่าให้ดึงข้อมูลจากคนตี ไม่ใช่เพื่อน
      const { data: queueData, error } = await supabase
        .from("session_participants")
        .select(`
          id,
          queue_status,
          games_played_today,
          join_time,
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

  const waiting = participants.filter(p => p.queue_status === 'waiting');
  const playing = participants.filter(p => p.queue_status === 'playing');

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">📋 กระดานจัดคิว</h1>
          <Link href="/" className="bg-white text-gray-600 px-4 py-2 rounded-lg shadow-sm border hover:bg-gray-50 transition">
            กลับหน้าหลัก
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ฝั่งซ้าย: คนที่กำลังรอตี */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-orange-500 mb-4 flex items-center gap-2">
              <span className="bg-orange-100 p-2 rounded-lg">⏳</span> รอคิว ({waiting.length})
            </h2>
            <div className="space-y-3">
              {waiting.length === 0 ? (
                <p className="text-gray-400 text-center py-4">ยังไม่มีคนรอคิว</p>
              ) : (
                waiting.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-gray-400 w-5">{index + 1}.</div>
                      <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="profile" />
                      <div>
                        <p className="font-semibold text-gray-800">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                        <p className="text-xs text-gray-500">ตีไปแล้ว: {p.games_played_today} เกม</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ฝั่งขวา: คนที่กำลังตีอยู่ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-green-500 mb-4 flex items-center gap-2">
              <span className="bg-green-100 p-2 rounded-lg">🏸</span> กำลังลงสนาม ({playing.length})
            </h2>
            <div className="space-y-3">
              {playing.length === 0 ? (
                <p className="text-gray-400 text-center py-4">คอร์ดยังว่าง</p>
              ) : (
                playing.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="profile" />
                    <div>
                      <p className="font-semibold text-gray-800">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
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
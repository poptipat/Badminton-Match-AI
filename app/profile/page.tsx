"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("display_name", { ascending: true });
    if (data) setProfiles(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedProfileId) {
      setPlayerStats(null);
      return;
    }
    fetchPlayerStats(selectedProfileId);
  }, [selectedProfileId]);

  const fetchPlayerStats = async (profileId: string) => {
    setLoading(true);
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    
    if (session) {
      // ดึงข้อมูลการตีของวันนี้
      const { data: participantData } = await supabase
        .from("session_participants")
        .select("games_played_today, accumulated_shuttle_fee, queue_status, wins, losses, draws")
        .eq("session_id", session.id)
        .eq("profile_id", profileId)
        .single();
        
      const profileData = profiles.find(p => p.id === profileId);

      setPlayerStats({
        profile: profileData,
        session: participantData || { games_played_today: 0, accumulated_shuttle_fee: 0, queue_status: 'ไม่ได้ลงชื่อวันนี้', wins: 0, losses: 0, draws: 0 }
      });
    }
    setLoading(false);
  };

  // ปรับสี Tier ให้เข้ากับโทน Light Mode CI
  const getTier = (elo: number) => {
    if (elo >= 1600) return { name: "C (Competitor)", color: "text-[#013C58]", bg: "bg-[#013C58]/5", border: "border-[#013C58]" };
    if (elo >= 1400) return { name: "P (Pro)", color: "text-[#00537A]", bg: "bg-[#00537A]/5", border: "border-[#00537A]" };
    if (elo >= 1200) return { name: "S (Standard)", color: "text-[#F5A201]", bg: "bg-[#F5A201]/10", border: "border-[#F5A201]" };
    if (elo >= 1000) return { name: "N (Novice)", color: "text-[#FFBA42]", bg: "bg-[#FFBA42]/10", border: "border-[#FFBA42]" };
    return { name: "BG (Beginner)", color: "text-[#00537A]", bg: "bg-[#A8E8F9]/20", border: "border-[#A8E8F9]" };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        
        {/* 🌟 Header & Menu */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-200 pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58] drop-shadow-sm">
            🏸 โปรไฟล์ส่วนตัว
          </h1>
          <Link href="/queue" className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 hover:text-[#013C58] transition font-bold text-sm md:text-base w-full md:w-auto text-center">
            🔙 กลับหน้ากระดาน
          </Link>
        </div>

        {/* 🌟 ช่องค้นหาชื่อ (สไตล์การ์ดคลีนๆ) */}
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <label className="block text-[#00537A] mb-2 font-bold">ค้นหาชื่อของคุณเพื่อดูสถิติ:</label>
          <select 
            className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#F5A201] focus:bg-white transition font-medium"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            <option value="">-- เลือกชื่อผู้เล่น --</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>

        {loading && selectedProfileId ? (
          <p className="text-center text-[#F5A201] font-bold animate-pulse">กำลังโหลดข้อมูล...</p>
        ) : playerStats ? (
          <div className="space-y-5 md:space-y-6">
            
            {/* 🌟 การ์ดแสดงโปรไฟล์หลัก */}
            <div className={`bg-white p-5 md:p-6 rounded-3xl border-l-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 ${getTier(playerStats.profile.elo_rating).border}`}>
              <img 
                src={playerStats.profile.avatar_url || `https://ui-avatars.com/api/?name=${playerStats.profile.display_name}&background=random`} 
                className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover bg-slate-100 ring-4 ring-white shadow-md flex-shrink-0" 
                alt="profile" 
              />
              <div className="flex-1 text-center md:text-left w-full">
                <h2 className="text-2xl md:text-3xl font-black text-[#013C58] mb-1 truncate">{playerStats.profile.display_name}</h2>
                <p className={`font-bold text-base md:text-lg ${getTier(playerStats.profile.elo_rating).color}`}>
                  ระดับมือ: {getTier(playerStats.profile.elo_rating).name}
                </p>
                
                <div className="mt-3 inline-block bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm font-medium">
                  สถานะ: <span className={playerStats.session.queue_status === 'playing' ? 'text-[#F5A201] font-bold' : 'text-[#00537A] font-bold'}>
                    {playerStats.session.queue_status === 'playing' ? 'กำลังตีอยู่บนคอร์ด' : playerStats.session.queue_status === 'waiting' ? 'กำลังรอคิว' : playerStats.session.queue_status}
                  </span>
                </div>
                
                {/* 🌟 กล่องสถิติ แพ้/ชนะ/เสมอ (ดีไซน์สว่าง) */}
                <div className="mt-4 flex justify-center md:justify-start gap-2 md:gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-center flex-1 md:flex-none">
                    <p className="text-[10px] md:text-xs text-emerald-600 uppercase font-bold">ชนะ</p>
                    <p className="text-lg md:text-xl font-black text-emerald-600">{playerStats.session.wins || 0}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center flex-1 md:flex-none">
                    <p className="text-[10px] md:text-xs text-slate-500 uppercase font-bold">เสมอ</p>
                    <p className="text-lg md:text-xl font-black text-slate-600">{playerStats.session.draws || 0}</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl text-center flex-1 md:flex-none">
                    <p className="text-[10px] md:text-xs text-rose-500 uppercase font-bold">แพ้</p>
                    <p className="text-lg md:text-xl font-black text-rose-500">{playerStats.session.losses || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 🌟 กริตข้อมูลการตี (เกม, เงิน, ELO) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-slate-500 text-xs md:text-sm font-bold mb-1">ตีไปแล้ววันนี้</p>
                <p className="text-3xl md:text-4xl font-black text-[#013C58]">{playerStats.session.games_played_today} <span className="text-sm md:text-lg text-slate-400 font-bold">เกม</span></p>
              </div>
              
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <p className="text-slate-500 text-xs md:text-sm font-bold mb-1">ค่าลูกแบดสะสม</p>
                <p className="text-3xl md:text-4xl font-black text-rose-500">{(playerStats.session.games_played_today || 0) * 27} <span className="text-sm md:text-lg text-rose-300 font-bold">฿</span></p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
                <p className="text-slate-500 text-xs md:text-sm font-bold mb-1">คะแนน ELO</p>
                <p className="text-3xl md:text-4xl font-black text-[#F5A201]">{playerStats.profile.elo_rating}</p>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-3xl shadow-sm border-dashed">
            <p className="text-slate-400 font-medium">โปรดเลือกรายชื่อเพื่อดูสถิติของคุณ</p>
          </div>
        )}

      </div>
    </div>
  );
}
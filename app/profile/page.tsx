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
      // ดึงข้อมูลการตีของวันนี้ (เพิ่มการดึง wins, losses, draws)
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

  const getTier = (elo: number) => {
    if (elo >= 1600) return { name: "C (Competitor)", color: "text-purple-400", bg: "bg-purple-900/30", border: "border-purple-500" };
    if (elo >= 1400) return { name: "P (Pro)", color: "text-red-400", bg: "bg-red-900/30", border: "border-red-500" };
    if (elo >= 1200) return { name: "S (Standard)", color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-500" };
    if (elo >= 1000) return { name: "N (Novice)", color: "text-green-400", bg: "bg-green-900/30", border: "border-green-500" };
    return { name: "BG (Beginner)", color: "text-blue-400", bg: "bg-blue-900/30", border: "border-blue-500" };
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            🏸 โปรไฟล์ส่วนตัว
          </h1>
          <Link href="/queue" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
            กลับหน้ากระดาน
          </Link>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl mb-8">
          <label className="block text-gray-400 mb-2 font-semibold">เลือกชื่อของคุณเพื่อดูสถิติ:</label>
          <select 
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            <option value="">-- ค้นหาชื่อของคุณ --</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>

        {loading && selectedProfileId ? (
          <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : playerStats ? (
          <div className="space-y-6">
            
            <div className={`p-6 rounded-3xl border-l-4 shadow-2xl flex flex-col md:flex-row items-center md:items-start gap-6 ${getTier(playerStats.profile.elo_rating).bg} ${getTier(playerStats.profile.elo_rating).border}`}>
              <img 
                src={playerStats.profile.avatar_url || `https://ui-avatars.com/api/?name=${playerStats.profile.display_name}&background=random`} 
                className="w-24 h-24 rounded-full object-cover bg-white ring-4 ring-gray-800 shadow-lg" 
                alt="profile" 
              />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black text-white mb-1">{playerStats.profile.display_name}</h2>
                <p className={`font-bold text-lg ${getTier(playerStats.profile.elo_rating).color}`}>
                  ระดับมือ: {getTier(playerStats.profile.elo_rating).name}
                </p>
                <div className="mt-2 inline-block bg-gray-950 px-3 py-1 rounded-lg border border-gray-800 text-sm">
                  สถานะ: <span className={playerStats.session.queue_status === 'playing' ? 'text-green-400' : 'text-orange-400'}>{playerStats.session.queue_status === 'playing' ? 'กำลังตีอยู่บนคอร์ด' : playerStats.session.queue_status === 'waiting' ? 'กำลังรอคิว' : playerStats.session.queue_status}</span>
                </div>
                
                {/* 🌟 กล่องสถิติ แพ้/ชนะ/เสมอ เพิ่มเข้ามาตรงนี้ 🌟 */}
                <div className="mt-4 flex justify-center md:justify-start gap-2">
                  <div className="bg-green-900/40 border border-green-500/50 px-4 py-2 rounded-xl text-center">
                    <p className="text-[10px] text-green-400 uppercase font-bold">ชนะ</p>
                    <p className="text-xl font-black text-green-400">{playerStats.session.wins || 0}</p>
                  </div>
                  <div className="bg-gray-800/80 border border-gray-600/50 px-4 py-2 rounded-xl text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">เสมอ</p>
                    <p className="text-xl font-black text-gray-300">{playerStats.session.draws || 0}</p>
                  </div>
                  <div className="bg-red-900/40 border border-red-500/50 px-4 py-2 rounded-xl text-center">
                    <p className="text-[10px] text-red-400 uppercase font-bold">แพ้</p>
                    <p className="text-xl font-black text-red-400">{playerStats.session.losses || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col items-center justify-center text-center">
                <p className="text-gray-400 text-sm mb-1">ตีไปแล้ววันนี้</p>
                <p className="text-4xl font-black text-white">{playerStats.session.games_played_today} <span className="text-lg text-gray-500">เกม</span></p>
              </div>
              
              {/* 🌟 แก้ไขบั๊กคำนวณเงิน: เอาจำนวนเกม x 27 แบบสดๆ ตรงนี้เลย 🌟 */}
              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col items-center justify-center text-center">
                <p className="text-gray-400 text-sm mb-1">ค่าลูกแบดสะสม</p>
                <p className="text-4xl font-black text-red-400">{(playerStats.session.games_played_today || 0) * 27} <span className="text-lg text-gray-500">฿</span></p>
              </div>

              <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col items-center justify-center text-center col-span-2 md:col-span-1">
                <p className="text-gray-400 text-sm mb-1">คะแนน ELO</p>
                <p className="text-4xl font-black text-yellow-400">{playerStats.profile.elo_rating}</p>
              </div>
            </div>

          </div>
        ) : null}

      </div>
    </div>
  );
}
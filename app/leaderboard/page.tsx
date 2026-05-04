"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'elo' | 'ironman' | 'wins'>('elo');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    
    // 1. ดึงข้อมูล ELO ทั้งหมด
    const { data: eloData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, elo_rating")
      .order("elo_rating", { ascending: false }); 
    if (eloData) setPlayers(eloData);

    // 2. ดึงข้อมูลสถิติของ "วันนี้"
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    if (session) {
      const { data: statsData } = await supabase
        .from("session_participants")
        .select("games_played_today, wins, profiles!profile_id(display_name, avatar_url)")
        .eq("session_id", session.id);
      if (statsData) setDailyStats(statsData);
    }
    
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังโหลดตารางเทพ...</div>;

  // จัดกลุ่ม ELO
  const tierC = players.filter(p => p.elo_rating >= 1600);
  const tierP = players.filter(p => p.elo_rating >= 1400 && p.elo_rating < 1600);
  const tierS = players.filter(p => p.elo_rating >= 1200 && p.elo_rating < 1400);
  const tierN = players.filter(p => p.elo_rating >= 1000 && p.elo_rating < 1200);
  const tierBG = players.filter(p => p.elo_rating < 1000);

  // จัดอันดับคนเหล็ก (จำนวนเกม) และ เทพชัยชนะ (จำนวนชนะ) ของวันนี้
  const topIronMen = [...dailyStats].sort((a, b) => b.games_played_today - a.games_played_today).slice(0, 10);
  const topWinners = [...dailyStats].sort((a, b) => b.wins - a.wins).slice(0, 10);

  // Component ย่อยสำหรับเรนเดอร์กลุ่ม ELO
  const RenderTier = ({ title, data, colorClass, bgClass, borderClass }: any) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className={`text-sm md:text-base font-extrabold mb-3 pl-3 border-l-4 ${borderClass} ${colorClass}`}>{title}</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {data.map((player: any, index: number) => (
            <div key={player.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm w-6 text-center ${index < 3 ? colorClass : 'text-slate-400'}`}>{index + 1}</span>
                <img src={player.avatar_url || `https://ui-avatars.com/api/?name=${player.display_name}&background=random`} className={`w-10 h-10 rounded-full object-cover ring-2 ${borderClass}`} alt="profile" />
                <p className="font-bold text-[#013C58] text-sm md:text-base truncate">{player.display_name || "ไม่ทราบชื่อ"}</p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-black ${colorClass}`}>{player.elo_rating}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Component ย่อยสำหรับตารางประจำวัน
  const RenderDailyStats = ({ data, valueKey, label, colorClass, icon }: any) => {
    if (data.length === 0) return <p className="text-center text-slate-400 py-10">ยังไม่มีข้อมูลในวันนี้</p>;
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {data.map((item: any, index: number) => (
          item[valueKey] > 0 && (
            <div key={index} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-bold text-sm w-6 text-center">{index + 1}</span>
                {/* 🌟 จุดที่แก้ไข: ใส่ระบบรูปสำรอง (Fallback) ตรงนี้ครับ */}
                <img src={item.profiles.avatar_url || `https://ui-avatars.com/api/?name=${item.profiles.display_name}&background=random`} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100" alt="profile" />
                <p className="font-bold text-[#013C58] text-sm md:text-base">{item.profiles.display_name}</p>
              </div>
              <div className="text-right flex items-center gap-1.5">
                <span className="text-lg">{icon}</span>
                <p className={`text-2xl font-black ${colorClass}`}>{item[valueKey]}</p>
                <p className="text-xs text-slate-400 font-bold mt-1">{label}</p>
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-200 pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58] drop-shadow-sm">
            🏆 หอเกียรติยศ (Hall of Fame)
          </h1>
          <Link href="/queue" className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 hover:text-[#013C58] transition font-bold text-sm md:text-base w-full md:w-auto text-center">
            🔙 กลับหน้ากระดาน
          </Link>
        </div>

        {/* แท็บเมนู (Tabs) สลับดูตาราง */}
        <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200 mb-8 overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab('elo')} className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base whitespace-nowrap transition-all ${activeTab === 'elo' ? 'bg-[#013C58] text-white shadow-md' : 'text-slate-500 hover:text-[#013C58] hover:bg-slate-50'}`}>
            🥇 แรงค์กิ้ง ELO
          </button>
          <button onClick={() => setActiveTab('ironman')} className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base whitespace-nowrap transition-all ${activeTab === 'ironman' ? 'bg-[#F5A201] text-white shadow-md' : 'text-slate-500 hover:text-[#F5A201] hover:bg-slate-50'}`}>
            🦾 คนเหล็ก (วันนี้)
          </button>
          <button onClick={() => setActiveTab('wins')} className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm md:text-base whitespace-nowrap transition-all ${activeTab === 'wins' ? 'bg-[#FFBA42] text-[#013C58] shadow-md' : 'text-slate-500 hover:text-[#FFBA42] hover:bg-slate-50'}`}>
            👑 เทพชัยชนะ (วันนี้)
          </button>
        </div>

        {/* ตาราง ELO */}
        {activeTab === 'elo' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-lg font-black text-[#013C58] mb-4 bg-white border border-slate-200 shadow-sm py-3 rounded-2xl text-center">🔥 สายบน (Upper Bracket)</h1>
              <RenderTier title="C (Competitor) : 1600+" data={tierC} colorClass="text-[#013C58]" borderClass="border-[#013C58]" />
              <RenderTier title="P (Pro) : 1400 - 1599" data={tierP} colorClass="text-[#00537A]" borderClass="border-[#00537A]" />
              <RenderTier title="S (Standard) : 1200 - 1399" data={tierS} colorClass="text-[#F5A201]" borderClass="border-[#F5A201]" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#013C58] mb-4 bg-white border border-slate-200 shadow-sm py-3 rounded-2xl text-center">🌱 สายล่าง (Lower Bracket)</h1>
              <RenderTier title="N (Novice) : 1000 - 1199" data={tierN} colorClass="text-[#FFBA42]" borderClass="border-[#FFBA42]" />
              <RenderTier title="BG (Beginner) : ต่ำกว่า 1000" data={tierBG} colorClass="text-[#A8E8F9]" borderClass="border-[#A8E8F9]" />
            </div>
          </div>
        )}

        {/* ตาราง คนเหล็ก (ตีเยอะสุดวันนี้) */}
        {activeTab === 'ironman' && (
          <div className="animate-fade-in">
            <div className="mb-4 bg-[#F5A201]/10 border border-[#F5A201]/30 p-4 rounded-2xl text-center">
              <h2 className="font-extrabold text-[#F5A201] text-lg mb-1">🦾 สุดยอดคนเหล็กประจำวัน</h2>
              <p className="text-sm text-[#F5A201]/80 font-medium">ใครมาตีเยอะสุด ฟิตสุด ในวันนี้ ยกตำแหน่งนี้ให้เลย!</p>
            </div>
            <RenderDailyStats data={topIronMen} valueKey="games_played_today" label="เกม" colorClass="text-[#F5A201]" icon="🔥" />
          </div>
        )}

        {/* ตาราง เทพชัยชนะ (ชนะเยอะสุดวันนี้) */}
        {activeTab === 'wins' && (
          <div className="animate-fade-in">
            <div className="mb-4 bg-[#FFBA42]/10 border border-[#FFBA42]/30 p-4 rounded-2xl text-center">
              <h2 className="font-extrabold text-[#013C58] text-lg mb-1">👑 เทพแห่งชัยชนะประจำวัน</h2>
              <p className="text-sm text-[#013C58]/70 font-medium">คู่ตบมหากาฬ ใครเก็บแต้มชนะไปได้เยอะที่สุดของวันนี้!</p>
            </div>
            <RenderDailyStats data={topWinners} valueKey="wins" label="Win" colorClass="text-[#FFBA42]" icon="🏆" />
          </div>
        )}

      </div>
    </div>
  );
}
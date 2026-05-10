"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  // 🌟 เลิกเก็บ dailyStats ก้อนยักษ์ แล้วเก็บแยกเฉพาะ Top 10 ที่เรียงมาแล้ว
  const [topIronMen, setTopIronMen] = useState<any[]>([]);
  const [topWinners, setTopWinners] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'elo' | 'ironman' | 'wins'>('elo');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    
    // 1. ดึงข้อมูล ELO (🌟 เพิ่ม .limit() ป้องกันกรณีในอนาคตมีคน 1,000 คน มือถือจะเรนเดอร์ไม่ไหว ดึงมาแค่ Top 150 พอ)
    const { data: eloData } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, elo_rating")
      .order("elo_rating", { ascending: false })
      .limit(150); 
      
    if (eloData) setPlayers(eloData);

    // 2. ดึงข้อมูลสถิติของ "วันนี้"
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    
    if (session) {
      // 🚀 ท่าไม้ตายมืออาชีพ: ให้ Database เรียงลำดับและตัด Top 10 ให้เลย และใช้ Promise.all ดึง 2 ตารางพร้อมกันในเสี้ยววินาที!
      const [ { data: ironmenData }, { data: winnersData } ] = await Promise.all([
        supabase
          .from("session_participants")
          .select("games_played_today, profiles!profile_id(display_name, avatar_url)")
          .eq("session_id", session.id)
          .order("games_played_today", { ascending: false })
          .limit(10), // เอาแค่ 10 คนแรก!
        supabase
          .from("session_participants")
          .select("wins, profiles!profile_id(display_name, avatar_url)")
          .eq("session_id", session.id)
          .order("wins", { ascending: false })
          .limit(10) // เอาแค่ 10 คนแรก!
      ]);

      if (ironmenData) setTopIronMen(ironmenData);
      if (winnersData) setTopWinners(winnersData);
    }
    
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังโหลดข้อมูล...</div>;

  // จัดกลุ่ม ELO
  const tierC = players.filter(p => p.elo_rating >= 1600);
  const tierP = players.filter(p => p.elo_rating >= 1400 && p.elo_rating < 1600);
  const tierS = players.filter(p => p.elo_rating >= 1200 && p.elo_rating < 1400);
  const tierN = players.filter(p => p.elo_rating >= 1000 && p.elo_rating < 1200);
  const tierBG = players.filter(p => p.elo_rating < 1000);

 
  // Component ย่อยสำหรับเรนเดอร์กลุ่ม ELO
  const RenderTier = ({ title, data, colorClass, borderClass }: any) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className={`text-sm md:text-base font-extrabold mb-3 pl-3 border-l-4 ${borderClass} text-slate-700`}>{title}</h2>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
          {data.map((player: any, index: number) => (
            <div key={player.id} className="flex items-center justify-between p-3.5 md:p-4 hover:bg-slate-50 transition">
              <div className="flex items-center gap-3 w-full min-w-0 pr-2">
                <span className={`font-black text-base md:text-lg w-5 text-center ${index < 3 ? colorClass : 'text-slate-300'}`}>{index + 1}</span>
                {/* 🌟 จุดแก้ไข: ลบกรอบสีออก เปลี่ยนเป็นกรอบสีเทาอ่อน สไตล์มินิมอล */}
                <img src={player.avatar_url || `https://ui-avatars.com/api/?name=${player.display_name}&background=random`} className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0 bg-white" alt="profile" />
                <p className="font-bold text-slate-700 text-sm md:text-base truncate min-w-0">{player.display_name || "ไม่ทราบชื่อ"}</p>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end">
                <p className={`text-xl md:text-2xl font-black tracking-tight ${colorClass}`}>{player.elo_rating}</p>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider -mt-1">ELO</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Component ย่อยสำหรับตารางประจำวัน
  const RenderDailyStats = ({ data, valueKey, label, colorClass, icon }: any) => {
    if (data.length === 0) return <p className="text-center text-slate-400 py-10 font-medium">ยังไม่มีข้อมูลในวันนี้</p>;
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
        {data.map((item: any, index: number) => (
          item[valueKey] > 0 && (
            <div key={index} className="flex items-center justify-between p-3.5 md:p-4 hover:bg-slate-50 transition">
              <div className="flex items-center gap-3 w-full min-w-0 pr-2">
                <span className={`font-black text-base md:text-lg w-5 text-center ${index < 3 ? colorClass : 'text-slate-300'}`}>{index + 1}</span>
                <img src={item.profiles.avatar_url || `https://ui-avatars.com/api/?name=${item.profiles.display_name}&background=random`} className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0 bg-white" alt="profile" />
                <p className="font-bold text-slate-700 text-sm md:text-base truncate min-w-0">{item.profiles.display_name}</p>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm md:text-base drop-shadow-sm">{icon}</span>
                  <p className={`text-xl md:text-2xl font-black tracking-tight ${colorClass}`}>{item[valueKey]}</p>
                </div>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
              </div>
            </div>
          )
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 p-4 md:p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        
        {/* 🌟 Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58] flex items-center gap-2">
            <span className="text-3xl md:text-4xl drop-shadow-sm">🏆</span> หอเกียรติยศ
          </h1>
          <Link href="/queue" className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-full shadow-sm hover:bg-slate-50 hover:text-[#013C58] transition font-bold text-sm md:text-base w-full md:w-auto text-center active:scale-95">
            🔙 กลับหน้ากระดาน
          </Link>
        </div>

        {/* 🌟 แท็บเมนู (Tabs) แก้ปัญหาตกขอบในมือถือ */}
        <div className="flex w-full bg-white rounded-3xl p-1.5 shadow-sm border border-slate-200 mb-8 relative z-10">
          <button onClick={() => setActiveTab('elo')} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3 px-1 rounded-2xl transition-all ${activeTab === 'elo' ? 'bg-[#013C58] text-white shadow-md scale-100' : 'text-slate-400 hover:text-[#013C58] hover:bg-slate-50'}`}>
            <span className="text-xl md:text-base drop-shadow-sm">🥇</span> 
            <span className="font-bold text-[11px] md:text-sm">แรงค์กิ้ง ELO</span>
          </button>
          <button onClick={() => setActiveTab('ironman')} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3 px-1 rounded-2xl transition-all ${activeTab === 'ironman' ? 'bg-[#F5A201] text-white shadow-md scale-100' : 'text-slate-400 hover:text-[#F5A201] hover:bg-slate-50'}`}>
            <span className="text-xl md:text-base drop-shadow-sm">🦾</span> 
            <span className="font-bold text-[11px] md:text-sm">คนเหล็ก (วันนี้)</span>
          </button>
          <button onClick={() => setActiveTab('wins')} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3 px-1 rounded-2xl transition-all ${activeTab === 'wins' ? 'bg-[#FFBA42] text-[#013C58] shadow-md scale-100' : 'text-slate-400 hover:text-[#FFBA42] hover:bg-slate-50'}`}>
            <span className="text-xl md:text-base drop-shadow-sm">👑</span> 
            <span className="font-bold text-[11px] md:text-sm">ชนะรวด (วันนี้)</span>
          </button>
        </div>

        {/* 🌟 ตาราง ELO */}
        {activeTab === 'elo' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <h1 className="text-sm font-black text-[#013C58] mb-4 bg-[#013C58]/5 border border-[#013C58]/10 py-2.5 rounded-2xl text-center uppercase tracking-widest">🔥 Upper Bracket</h1>
              <RenderTier title="C (Competitor) : 1600+" data={tierC} colorClass="text-[#013C58]" borderClass="border-[#013C58]" />
              <RenderTier title="P (Pro) : 1400 - 1599" data={tierP} colorClass="text-[#00537A]" borderClass="border-[#00537A]" />
              <RenderTier title="S (Standard) : 1200 - 1399" data={tierS} colorClass="text-[#F5A201]" borderClass="border-[#F5A201]" />
            </div>
            <div>
              <h1 className="text-sm font-black text-[#F5A201] mb-4 bg-[#FFFBF0] border border-[#FFBA42]/20 py-2.5 rounded-2xl text-center uppercase tracking-widest">🌱 Lower Bracket</h1>
              <RenderTier title="N (Novice) : 1000 - 1199" data={tierN} colorClass="text-[#FFBA42]" borderClass="border-[#FFBA42]" />
              <RenderTier title="BG (Beginner) : ต่ำกว่า 1000" data={tierBG} colorClass="text-[#A8E8F9]" borderClass="border-[#A8E8F9]" />
            </div>
          </div>
        )}

        {/* 🌟 ตาราง คนเหล็ก (ตีเยอะสุดวันนี้) */}
        {activeTab === 'ironman' && (
          <div className="animate-fade-in">
            <div className="mb-5 bg-[#FFFBF0] border border-[#F5A201]/20 p-5 rounded-3xl text-center shadow-sm">
              <h2 className="font-black text-[#F5A201] text-lg md:text-xl mb-1">🦾 สุดยอดคนเหล็กประจำวัน</h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium">ใครฟิตสุด ขยันลงคอร์ดสุดในวันนี้ ยกตำแหน่งนี้ให้เลย!</p>
            </div>
            <RenderDailyStats data={topIronMen} valueKey="games_played_today" label="เกม" colorClass="text-[#F5A201]" icon="🔥" />
          </div>
        )}

        {/* 🌟 ตาราง เทพชัยชนะ (ชนะเยอะสุดวันนี้) */}
        {activeTab === 'wins' && (
          <div className="animate-fade-in">
            <div className="mb-5 bg-[#013C58]/5 border border-[#013C58]/10 p-5 rounded-3xl text-center shadow-sm">
              <h2 className="font-black text-[#013C58] text-lg md:text-xl mb-1">👑 เทพแห่งชัยชนะประจำวัน</h2>
              <p className="text-xs md:text-sm text-slate-500 font-medium">ใครเก็บแต้มชนะไปได้เยอะที่สุดของวันนี้ ดูได้ที่นี่!</p>
            </div>
            <RenderDailyStats data={topWinners} valueKey="wins" label="Win" colorClass="text-[#FFBA42]" icon="🏆" />
          </div>
        )}

      </div>
    </div>
  );
}
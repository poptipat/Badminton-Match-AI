"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, elo_rating")
      .order("elo_rating", { ascending: false }); 

    if (data) setPlayers(data);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">กำลังโหลดข้อมูลเทพแบด...</div>;

  // แบ่งกลุ่มตามช่วงคะแนน (สายบน / สายล่าง)
  const tierC = players.filter(p => p.elo_rating >= 1600);
  const tierP = players.filter(p => p.elo_rating >= 1400 && p.elo_rating < 1600);
  const tierS = players.filter(p => p.elo_rating >= 1200 && p.elo_rating < 1400);
  const tierN = players.filter(p => p.elo_rating >= 1000 && p.elo_rating < 1200);
  const tierBG = players.filter(p => p.elo_rating < 1000);

  // Component สำหรับเรนเดอร์กลุ่ม
  const RenderTier = ({ title, data, colorClass, borderClass }: any) => {
    if (data.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className={`text-xl font-bold mb-4 pl-3 border-l-4 ${borderClass} ${colorClass}`}>{title}</h2>
        <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden divide-y divide-gray-800">
          {data.map((player: any, index: number) => (
            <div key={player.id} className="flex items-center justify-between p-4 hover:bg-gray-800 transition">
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-bold text-lg w-6 text-center">{index + 1}</span>
                <img 
                  src={player.avatar_url || `https://ui-avatars.com/api/?name=${player.display_name || "Unknown"}&background=random`} 
                  className="w-10 h-10 rounded-full object-cover bg-white ring-2 ring-gray-700" 
                  alt="profile" 
                />
                <p className="font-bold text-white text-lg">{player.display_name || "ไม่ทราบชื่อ"}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${colorClass}`}>{player.elo_rating}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">ELO</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            🏆 ตารางจัดอันดับมือ
          </h1>
          {/* เปลี่ยนให้ปุ่มนี้วิ่งไปหน้าคิวที่คนทั่วไปดูได้ */}
          <Link href="/queue" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition shadow-md">
            🔙 กระดานคิว
          </Link>
        </div>

        {/* เรนเดอร์สายบน */}
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold text-white mb-6 text-center bg-gray-800 py-2 rounded-lg">🔥 สายบน (Upper Bracket)</h1>
          <RenderTier title="ระดับ C (Competitor / มือแข่งขัน)" data={tierC} colorClass="text-purple-400" borderClass="border-purple-500" />
          <RenderTier title="ระดับ P (Pro / ฝีมือระดับสูง)" data={tierP} colorClass="text-red-400" borderClass="border-red-500" />
          <RenderTier title="ระดับ S (Standard / ตีเป็นเกม)" data={tierS} colorClass="text-yellow-400" borderClass="border-yellow-500" />
        </div>

        {/* เรนเดอร์สายล่าง */}
        <div>
          <h1 className="text-2xl font-extrabold text-white mb-6 text-center bg-gray-800 py-2 rounded-lg">🌱 สายล่าง (Lower Bracket)</h1>
          <RenderTier title="ระดับ N (Novice / พอตีโต้ได้)" data={tierN} colorClass="text-green-400" borderClass="border-green-500" />
          <RenderTier title="ระดับ BG (Beginner / เพิ่งหัดเล่น)" data={tierBG} colorClass="text-blue-400" borderClass="border-blue-500" />
        </div>

      </div>
    </div>
  );
}
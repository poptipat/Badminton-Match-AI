"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalUnpaid: 0,
    totalGames: 0,
    totalSessions: 0,
    totalPlayers: 0
  });
  const [dailyData, setDailyData] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    // 1. ดึงข้อมูลก๊วน 30 วันล่าสุด
    const { data: sessions } = await supabase
      .from("daily_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);

      // 2. ดึงข้อมูลผู้เล่นทั้งหมดที่อยู่ใน 30 ก๊วนนี้
      const { data: participants } = await supabase
        .from("session_participants")
        .select("*")
        .in("session_id", sessionIds);

      let overallRevenue = 0;
      let overallUnpaid = 0;
      let overallGames = 0;
      let overallPlayers = 0;

      // 3. ประมวลผลข้อมูลแยกตามวัน
      const processedData = sessions.map(session => {
        const sessionParts = participants?.filter(p => p.session_id === session.id) || [];
        
        let dailyRevenue = 0;
        let dailyUnpaid = 0;
        let dailyGames = 0;
        let activePlayers = 0; // นับเฉพาะคนที่ลงสนามหรือมียอดต้องจ่าย

        sessionParts.forEach(p => {
          const totalFee = (p.total_amount_due || 0) + (p.accumulated_shuttle_fee || 0);
          
          if (totalFee > 0) {
            activePlayers += 1;
            dailyGames += (p.games_played_today || 0);

            if (p.payment_status === 'paid') {
              dailyRevenue += totalFee;
            } else {
              dailyUnpaid += totalFee;
            }
          }
        });

        // บวกเข้ายอดรวมใหญ่
        overallRevenue += dailyRevenue;
        overallUnpaid += dailyUnpaid;
        overallGames += dailyGames;
        overallPlayers += activePlayers;

        return {
          id: session.id,
          date: new Date(session.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
          isActive: session.is_active,
          revenue: dailyRevenue,
          unpaid: dailyUnpaid,
          games: dailyGames,
          players: activePlayers
        };
      });

      setDailyData(processedData);
      setSummary({
        totalRevenue: overallRevenue,
        totalUnpaid: overallUnpaid,
        totalGames: overallGames,
        totalSessions: sessions.length,
        totalPlayers: overallPlayers
      });
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-indigo-400 font-bold text-xl">กำลังประมวลผลบัญชี...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* 🌟 Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-800 pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-gray-100 flex items-center gap-2">
            <span className="text-indigo-500">📊</span> สรุปยอด 30 วันล่าสุด
          </h1>
          <Link href="/admin" className="w-full md:w-auto bg-gray-800 border border-gray-700 text-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-700 transition shadow-md font-bold text-center text-sm md:text-base">
            🔙 กลับหน้าจัดคอร์ด
          </Link>
        </div>

        {/* 🌟 Dashboard สรุปภาพรวม */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-indigo-900/20 rounded-2xl p-4 border border-indigo-500/30 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">รายรับรวม (Paid)</p>
            <p className="text-2xl md:text-3xl font-black text-indigo-400">{summary.totalRevenue} <span className="text-sm font-medium text-indigo-600">฿</span></p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-sm text-center">
            <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">หนี้ค้างสะสม</p>
            <p className="text-2xl md:text-3xl font-black text-rose-400">{summary.totalUnpaid} <span className="text-sm font-medium text-rose-600">฿</span></p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-sm text-center">
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">ยอดผู้เล่นรวม</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-400">{summary.totalPlayers} <span className="text-sm font-medium text-emerald-600">คน</span></p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-sm text-center">
            <p className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">เปิดก๊วนไปแล้ว</p>
            <p className="text-2xl md:text-3xl font-black text-yellow-500">{summary.totalSessions} <span className="text-sm font-medium text-yellow-700">วัน</span></p>
          </div>
        </div>

        {/* 🌟 ตารางแจกแจงรายวัน */}
        <div className="bg-gray-900/50 rounded-3xl p-5 md:p-6 border border-gray-800 shadow-xl">
          <h2 className="text-lg md:text-xl font-bold text-gray-300 mb-4 flex items-center gap-2">
            📅 ประวัติรายวัน
          </h2>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-sm uppercase tracking-wider">
                  <th className="pb-3 pl-2 font-semibold">วันที่</th>
                  <th className="pb-3 text-center font-semibold">สถานะ</th>
                  <th className="pb-3 text-center font-semibold">คนตี</th>
                  <th className="pb-3 text-center font-semibold">เกม</th>
                  <th className="pb-3 text-right font-semibold">ค้างชำระ</th>
                  <th className="pb-3 text-right pr-2 font-semibold">รายรับ (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">ยังไม่มีประวัติการเปิดก๊วน</td>
                  </tr>
                ) : (
                  dailyData.map((day) => (
                    <tr key={day.id} className="hover:bg-gray-800/30 transition">
                      <td className="py-4 pl-2 font-bold text-gray-200">{day.date}</td>
                      <td className="py-4 text-center">
                        {day.isActive ? (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-full border border-emerald-500/30">กำลังเปิด</span>
                        ) : (
                          <span className="bg-gray-800 text-gray-400 text-[10px] font-black px-2 py-1 rounded-full border border-gray-700">ปิดแล้ว</span>
                        )}
                      </td>
                      <td className="py-4 text-center text-gray-400 font-medium">{day.players}</td>
                      <td className="py-4 text-center text-gray-400 font-medium">{day.games}</td>
                      <td className="py-4 text-right font-bold text-rose-400">{day.unpaid > 0 ? `${day.unpaid}` : '-'}</td>
                      <td className="py-4 text-right pr-2 font-black text-indigo-400">{day.revenue}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
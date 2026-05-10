"use client";
import Link from "next/link";
import { useQueueBoard } from "@/hooks/useQueueBoard";
import { motion, AnimatePresence } from "framer-motion"; // 🌟 นำเข้าอาวุธลับ

// 🌟 ย้ายฟังก์ชันคำนวณ Elo ออกมาข้างนอก ป้องกันไม่ให้มันคำนวณใหม่พร่ำเพรื่อตอน Animation ทำงาน
const getBestPairing = (fourPlayers: any[]) => {
  if (!fourPlayers || fourPlayers.length !== 4) return null;
  const p = fourPlayers;
  const getElo = (player: any) => player.profiles?.elo_rating || 1200;

  const diff1 = Math.abs((getElo(p[0]) + getElo(p[1])) - (getElo(p[2]) + getElo(p[3])));
  const diff2 = Math.abs((getElo(p[0]) + getElo(p[2])) - (getElo(p[1]) + getElo(p[3])));
  const diff3 = Math.abs((getElo(p[0]) + getElo(p[3])) - (getElo(p[1]) + getElo(p[2])));

  const minDiff = Math.min(diff1, diff2, diff3);
  if (minDiff === diff1) return { teamA: [p[0], p[1]], teamB: [p[2], p[3]] };
  if (minDiff === diff2) return { teamA: [p[0], p[2]], teamB: [p[1], p[3]] };
  return { teamA: [p[0], p[3]], teamB: [p[1], p[2]] };
};

export default function QueueBoard() {
  const { loading, isAdmin, waiting, preparingByCourt, playingByCourt } = useQueueBoard();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังโหลดกระดานคิว...</div>;

  // 🌟 เปลี่ยนจาก Component ซ้อน Component มาเป็นฟังก์ชันคืนค่าธรรมดา (ลดภาระ CPU ฝั่งหน้าจอทีวี)
  const renderMatchPairing = (players: any[]) => {
    const match = getBestPairing(players);
    if (!match) {
      return (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {players.map(p => (
              <motion.div
                key={p.id}
                layoutId={`player-${p.id}`} // 🌟 เวทมนตร์ลอยข้ามคอลัมน์อยู่ที่คำสั่งนี้!
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex items-center gap-2 p-2 bg-white rounded-xl shadow-sm border border-slate-100"
              >
                <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=random`} className="w-8 h-8 rounded-full object-cover border border-slate-100" alt="profile" />
                <p className="font-semibold text-slate-700 text-sm truncate">{p.profiles?.display_name}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="relative flex flex-col gap-2">
        <div className="bg-[#A8E8F9]/20 border border-[#A8E8F9]/50 rounded-xl p-2 shadow-sm">
          <p className="text-[10px] font-black text-[#00537A] mb-1.5 uppercase px-1">🟦 ทีม A</p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {match.teamA.map((p: any) => (
                <motion.div
                  key={p.id}
                  layoutId={`player-${p.id}`} // 🌟 ยืนยันรหัสไอดีเดิม มันถึงจะรู้ว่าต้องลอยมาจากไหน
                  className="flex items-center gap-2 bg-white/60 p-1.5 rounded-lg"
                >
                  <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=00537A&color=fff`} className="w-7 h-7 rounded-full object-cover" alt="profile" />
                  <p className="font-bold text-[#013C58] text-sm truncate">{p.profiles?.display_name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-white border border-slate-200 shadow-sm rounded-full px-2 py-0.5">
          <span className="text-[10px] font-black text-slate-400 italic">VS</span>
        </div>

        <div className="bg-[#F5A201]/10 border border-[#F5A201]/30 rounded-xl p-2 shadow-sm">
          <p className="text-[10px] font-black text-[#F5A201] mb-1.5 uppercase px-1 text-right">ทีม B 🟧</p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {match.teamB.map((p: any) => (
                <motion.div
                  key={p.id}
                  layoutId={`player-${p.id}`}
                  className="flex items-center gap-2 bg-white/60 p-1.5 rounded-lg flex-row-reverse text-right"
                >
                  <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=F5A201&color=fff`} className="w-7 h-7 rounded-full object-cover" alt="profile" />
                  <p className="font-bold text-[#F5A201] text-sm truncate">{p.profiles?.display_name}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Menu */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58]">📋 กระดานจัดคิว</h1>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {isAdmin && (
              <Link href="/admin" className="bg-[#00537A] text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-[#013C58] transition font-bold text-sm md:text-base flex-1 text-center whitespace-nowrap">
                👑 ระบบแอดมิน
              </Link>
            )}
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

        {/* ตาราง 3 คอลัมน์ */}
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
                <AnimatePresence mode="popLayout">
                  {waiting.map((p, index) => (
                    <motion.div 
                      key={p.id}
                      layoutId={`player-${p.id}`} // 🌟 ไอดีเดียวกันกับช่องอื่น เพื่อให้มันรู้ว่าต้องลอยสลับกัน
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 transition"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="font-bold text-slate-400 w-5 text-sm">{index + 1}.</div>
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=fff`} className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0" alt="profile" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#013C58] truncate">{p.profiles?.display_name || "ไม่ทราบชื่อ"}</p>
                          <p className="text-xs text-slate-500">ตีไปแล้ว: {p.games_played_today} เกม</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 2: เตรียมลงสนาม */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#00537A]"></div>
            <h2 className="text-xl font-bold text-[#00537A] mb-5 flex items-center gap-2">
              <span className="bg-[#A8E8F9]/30 text-[#00537A] p-2 rounded-lg border border-[#A8E8F9]/50">🎽</span> เตรียมลงสนาม ({Object.values(preparingByCourt).flat().length})
            </h2>
            <div className="space-y-4">
              {Object.keys(preparingByCourt).length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm font-medium">ยังไม่มีคิวเตรียมลง</p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {Object.keys(preparingByCourt).map((courtNum) => (
                    <motion.div 
                      key={`prep-court-${courtNum}`} 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-slate-50 p-4 rounded-2xl border border-slate-200"
                    >
                      <h3 className="font-extrabold text-[#013C58] text-sm mb-3 border-b border-slate-200 pb-2">📍 เตรียมลงคอร์ดที่ {courtNum}</h3>
                      {renderMatchPairing(preparingByCourt[Number(courtNum)])}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* คอลัมน์ที่ 3: กำลังลงสนาม */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 md:p-6 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F5A201] to-[#FFBA42]"></div>
            <h2 className="text-xl font-bold text-[#013C58] mb-5 flex items-center gap-2">
              <span className="bg-[#00537A]/10 text-[#00537A] p-2 rounded-lg border border-[#00537A]/20">🏸</span> กำลังลงสนาม ({Object.values(playingByCourt).flat().length})
            </h2>
            <div className="space-y-4">
              {Object.keys(playingByCourt).length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm font-medium">คอร์ดยังว่าง</p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {Object.keys(playingByCourt).map((courtNum) => (
                    <motion.div 
                      key={`play-court-${courtNum}`}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-[#FFFBF0] p-4 rounded-2xl border border-[#F5A201]/30"
                    >
                      <div className="flex justify-between items-center mb-3 border-b border-[#F5A201]/20 pb-2">
                          <h3 className="font-extrabold text-[#F5A201] text-sm">🔥 กำลังตี คอร์ด {courtNum}</h3>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                      </div>
                      {renderMatchPairing(playingByCourt[Number(courtNum)])}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
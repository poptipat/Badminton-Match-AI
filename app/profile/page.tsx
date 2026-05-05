"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

// 🌟 เปลี่ยนเส้นทาง URL ให้ชี้ไปที่โฟลเดอร์ /avatars/ ในโปรเจกต์ของเรา
const AVATAR_OPTIONS = [
  { id: 'av1', name: 'สไตล์ 1', url: '/avatars/avatar-1.png' },
  { id: 'av2', name: 'สไตล์ 2', url: '/avatars/avatar-2.png' },
  { id: 'av3', name: 'สไตล์ 3', url: '/avatars/avatar-3.png' },
  { id: 'av4', name: 'สไตล์ 4', url: '/avatars/avatar-4.png' },
  { id: 'av5', name: 'สไตล์ 5', url: '/avatars/avatar-5.png' },
  { id: 'av6', name: 'สไตล์ 6', url: '/avatars/avatar-6.png' },
  { id: 'av7', name: 'สไตล์ 7', url: '/avatars/avatar-7.png' },
  { id: 'av8', name: 'สไตล์ 8', url: '/avatars/avatar-8.png' },
  { id: 'av9', name: 'สไตล์ 9', url: '/avatars/avatar-9.png' },
  { id: 'av10', name: 'สไตล์ 10', url: '/avatars/avatar-10.png' },
  { id: 'av11', name: 'สไตล์ 11', url: '/avatars/avatar-11.png' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🌟 State สำหรับโหมดแก้ไข
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. ดึงข้อมูลโปรไฟล์
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        setEditName(userProfile.display_name);
        setEditAvatar(userProfile.avatar_url || user.user_metadata.picture); // ใช้รูปตั้งต้นจาก LINE ถ้ายังไม่เคยเลือก
      }

      // 2. ดึงสถิติการเล่นทั้งหมด
      const { data: matchStats } = await supabase
        .from("session_participants")
        .select("games_played_today, wins, losses, draws")
        .eq("profile_id", user.id);

      if (matchStats && matchStats.length > 0) {
        const totalGames = matchStats.reduce((acc, curr) => acc + (curr.games_played_today || 0), 0);
        const totalWins = matchStats.reduce((acc, curr) => acc + (curr.wins || 0), 0);
        const totalLosses = matchStats.reduce((acc, curr) => acc + (curr.losses || 0), 0);
        const totalDraws = matchStats.reduce((acc, curr) => acc + (curr.draws || 0), 0);

        const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

        setStats({ totalGames, totalWins, totalLosses, totalDraws, winRate });
      } else {
        setStats({ totalGames: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, winRate: 0 });
      }
    }
    setLoading(false);
  };

  // 🌟 ฟังก์ชันบันทึกการแก้ไขโปรไฟล์
  const handleSaveProfile = async () => {
    if (!editName.trim()) return alert("กรุณาใส่ชื่อของคุณด้วยครับ!");
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ 
        display_name: editName,
        avatar_url: editAvatar 
      })
      .eq("id", profile.id);

    if (error) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    } else {
      alert("✅ อัปเดตโปรไฟล์เรียบร้อยแล้ว!");
      setIsEditing(false);
      fetchProfile(); // โหลดข้อมูลใหม่มาโชว์
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังโหลดโปรไฟล์...</div>;

  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-2xl font-bold text-slate-700 mb-4">ไม่พบข้อมูลโปรไฟล์</h1>
      <Link href="/" className="bg-[#00537A] text-white px-6 py-2 rounded-xl hover:bg-[#013C58] transition">กลับหน้าหลัก</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
          <h1 className="text-2xl md:text-3xl font-black text-[#013C58]">👤 โปรไฟล์ของฉัน</h1>
          <Link href="/" className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-50 font-bold transition">
            🏠 หน้าหลัก
          </Link>
        </div>

        {/* 🌟 การ์ดโปรไฟล์หลัก */}
        <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-[#013C58] to-[#00537A]"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            
            {/* โหมดแก้ไข (Edit Mode) */}
            {isEditing ? (
              <div className="w-full flex flex-col items-center bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-6 shadow-inner">
                <h3 className="font-bold text-[#013C58] mb-4 text-lg">✨ แก้ไขโปรไฟล์</h3>
                
                {/* เลือก Avatar */}
                <p className="text-sm font-semibold text-slate-500 mb-2 w-full text-left">เลือกคาแรคเตอร์ของคุณ:</p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6 w-full">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button 
                      key={avatar.id}
                      onClick={() => setEditAvatar(avatar.url)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${editAvatar === avatar.url ? 'border-[#F5A201] bg-[#FFFBF0] shadow-sm scale-105' : 'border-transparent hover:bg-slate-100'}`}
                      title={avatar.name}
                    >
                      <img src={avatar.url} alt={avatar.name} className="w-12 h-12 rounded-full shadow-sm" />
                    </button>
                  ))}
                  {/* ปุ่มใช้รูปตั้งต้นจาก LINE */}
                  <button 
                    onClick={() => setEditAvatar(`https://ui-avatars.com/api/?name=${editName}&background=random`)} // Fallback if no line pic
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${!AVATAR_OPTIONS.some(a => a.url === editAvatar) ? 'border-[#013C58] bg-slate-100 shadow-sm scale-105' : 'border-transparent hover:bg-slate-100'}`}
                    title="รูปเดิมจาก LINE"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs font-bold shadow-sm">เดิม</div>
                  </button>
                </div>

                {/* เปลี่ยนชื่อ */}
                <p className="text-sm font-semibold text-slate-500 mb-2 w-full text-left">ฉายา / ชื่อในคอร์ด:</p>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={15}
                  placeholder="ตั้งชื่อเท่ๆ (ไม่เกิน 15 ตัว)"
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#F5A201] text-center font-bold text-slate-700 text-lg mb-6"
                />

                <div className="flex gap-3 w-full">
                  <button onClick={() => setIsEditing(false)} className="flex-1 bg-white border border-slate-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition">ยกเลิก</button>
                  <button onClick={handleSaveProfile} disabled={saving} className="flex-1 bg-[#F5A201] text-white font-bold py-3 rounded-xl hover:bg-[#FFBA42] shadow-md transition disabled:bg-slate-400">
                    {saving ? "กำลังเซฟ..." : "💾 บันทึก"}
                  </button>
                </div>
              </div>
            ) : (
              // โหมดแสดงผลปกติ (View Mode)
              <>
                <img 
                  src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=random`} 
                  alt="Profile" 
                  className="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-white shadow-lg object-cover mb-4 bg-white" 
                />
                <h2 className="text-2xl md:text-3xl font-black text-[#013C58] mb-1">{profile.display_name}</h2>
                
                {/* 🌟 ป้าย Badge บอกแรงค์ */}
                <div className="mt-2 mb-6">
                  {profile.elo_rating >= 1600 ? <span className="bg-[#013C58] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">👑 Class C (Competitor)</span> :
                   profile.elo_rating >= 1400 ? <span className="bg-[#00537A] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🌟 Class P (Pro)</span> :
                   profile.elo_rating >= 1200 ? <span className="bg-[#F5A201] text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🔥 Class S (Standard)</span> :
                   profile.elo_rating >= 1000 ? <span className="bg-[#FFBA42] text-[#013C58] px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🌱 Class N (Novice)</span> :
                   <span className="bg-[#A8E8F9] text-[#013C58] px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🐣 Class BG (Beginner)</span>
                  }
                </div>

                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white border border-slate-200 text-slate-600 hover:text-[#013C58] hover:border-[#013C58] px-5 py-2 rounded-xl text-sm font-bold transition shadow-sm active:scale-95 flex items-center gap-2"
                >
                  <span>⚙️</span> แก้ไขรูปและชื่อ
                </button>
              </>
            )}
          </div>
        </div>

        {/* 🌟 กล่องสถิติย่อย */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#013C58] rounded-2xl p-4 text-center shadow-md border border-[#00537A]">
            <p className="text-[#A8E8F9] text-xs font-bold uppercase tracking-wider mb-1">แต้ม ELO</p>
            <p className="text-3xl font-black text-white">{profile.elo_rating}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-200">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">ตีทั้งหมด</p>
            <p className="text-3xl font-black text-[#013C58]">{stats?.totalGames}</p>
            <p className="text-xs text-slate-500 font-medium">เกม</p>
          </div>
          <div className="bg-[#FFFBF0] rounded-2xl p-4 text-center shadow-sm border border-[#F5A201]/30">
            <p className="text-[#F5A201] text-xs font-bold uppercase tracking-wider mb-1">ชนะ</p>
            <p className="text-3xl font-black text-[#F5A201]">{stats?.totalWins}</p>
            <p className="text-xs text-[#F5A201]/80 font-medium">เกม</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-200 relative overflow-hidden">
             {/* กราฟแท่งเล็กๆ แบ็คกราวด์แสดง Win Rate */}
            <div className="absolute bottom-0 left-0 h-1 bg-emerald-400" style={{ width: `${stats?.winRate}%` }}></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">อัตราชนะ</p>
            <p className="text-3xl font-black text-[#00537A]">{stats?.winRate}%</p>
          </div>
        </div>

      </div>
    </div>
  );
}
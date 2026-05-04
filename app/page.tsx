"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [sessionToday, setSessionToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // States สำหรับฟีเจอร์ใหม่
  const [playerCount, setPlayerCount] = useState(0); 
  const [allProfiles, setAllProfiles] = useState<any[]>([]); 
  const [selectedPartner, setSelectedPartner] = useState<string>(""); 
  const [isJoined, setIsJoined] = useState(false); // เช็กว่าเราลงชื่อไปหรือยัง?

  useEffect(() => {
    checkUserAndSession();
  }, []);

  const checkUserAndSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      // 1. ดึงข้อมูลก๊วน
      const { data: session } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("is_active", true)
        .single();
      
      if (session) {
        setSessionToday(session);

        // 2. นับจำนวนคนที่ลงคิวไปแล้ว
        const { count } = await supabase
          .from("session_participants")
          .select("*", { count: 'exact', head: true })
          .eq("session_id", session.id);
        
        setPlayerCount(count || 0);

        // 3. ดึงรายชื่อเพื่อนมาทำ Dropdown
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .neq("id", user.id);
        
        setAllProfiles(profiles || []);

        // 4. เช็กว่า "ตัวเราเอง" ลงชื่อไปหรือยัง?
        const { data: myQueue } = await supabase
          .from("session_participants")
          .select("id")
          .eq("session_id", session.id)
          .eq("profile_id", user.id)
          .single();
        
        if (myQueue) setIsJoined(true);
      }
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "custom:line" as any,
      options: { redirectTo: window.location.origin },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSessionToday(null);
  };

  const handleJoinQueue = async () => {
    if (!sessionToday || !user) return;
    
    const { error } = await supabase
      .from("session_participants")
      .insert({
        session_id: sessionToday.id,
        profile_id: user.id,
        preferred_partner_id: selectedPartner || null,
        payment_status: "unpaid",
        queue_status: "waiting",
        total_amount_due: sessionToday.court_fee_flat 
      });

    if (error) {
      if (error.code === '23505') {
        alert("คุณได้ลงชื่อในก๊วนนี้ไปแล้วครับ!");
        setIsJoined(true);
      } else {
        alert("เกิดข้อผิดพลาดในการลงชื่อ กรุณาลองใหม่");
      }
    } else {
      alert("✅ ลงชื่อสำเร็จ! ลุยกันเลย 🏸");
      setPlayerCount(prev => prev + 1); 
      setIsJoined(true); // เปลี่ยนสถานะว่าลงชื่อแล้ว
    }
  };

  // ฟังก์ชันใหม่: ยกเลิกการลงชื่อ
  const handleCancelQueue = async () => {
    const confirmCancel = confirm("คุณแน่ใจหรือไม่ที่จะยกเลิกการลงชื่อ? (คิวของคุณจะถูกสละให้คนอื่น)");
    if (!confirmCancel) return;

    const { error } = await supabase
      .from("session_participants")
      .delete()
      .eq("session_id", sessionToday.id)
      .eq("profile_id", user.id);

    if (!error) {
      alert("ยกเลิกการลงชื่อเรียบร้อยแล้ว หวังว่าจะมาเล่นด้วยกันรอบหน้านะครับ!");
      setIsJoined(false);
      setPlayerCount(prev => prev - 1); // ลดจำนวนคนลง 1
      setSelectedPartner("");
    } else {
      alert("เกิดข้อผิดพลาดในการยกเลิกคิว");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold">กำลังโหลดข้อมูล...</div>;

  const isFull = sessionToday && playerCount >= sessionToday.max_players;

  // จัดรูปแบบวันที่ปัจจุบันเป็นภาษาไทย
  const todayDateFormatted = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans p-4 relative">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center max-w-md w-full">
        <h1 className="text-3xl font-extrabold mb-2 text-[#013C58]">🏸 ก๊วนแบดมินตัน</h1>
        <p className="text-slate-500 mb-8 font-medium">@ On Court Badminton</p>

        {user ? (
          <div>
            <img 
              src={user.user_metadata.picture || user.user_metadata.picture_url || user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.user_metadata.name}&background=random`} 
              alt="Profile" 
              className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-[#FFBA42] object-cover shadow-sm" 
            />
            <h2 className="text-2xl font-bold mb-2 text-[#013C58]">{user.user_metadata.name}</h2>
            
            <div className="bg-slate-50 rounded-2xl p-5 my-6 border border-slate-200">
              {sessionToday ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="relative flex h-3 w-3">
                      {!isFull && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                    </span>
                    <h3 className="text-[#00537A] font-bold text-lg">
                      {isFull ? "คิวเต็มแล้วสำหรับวันนี้!" : `ตีแบดวันที่ ${todayDateFormatted}`}
                    </h3>
                  </div>
                  
                  <p className="text-sm text-slate-600 font-medium">ค่าสนามเหมา {sessionToday.court_fee_flat} บ. | ค่าลูก {sessionToday.base_shuttle_fee} บ./เกม</p>
                  <p className={`text-sm mt-1 mb-4 font-bold ${isFull ? 'text-rose-500' : 'text-[#F5A201]'}`}>
                    มีคนลงชื่อแล้ว: {playerCount} / {sessionToday.max_players} คน
                  </p>

                  {/* 🌟 กล่องข้อความแจ้งเตือนเรื่องกฎการยกเลิก (โทนสีแบรนด์) */}
                  <div className="bg-[#FFFBF0] border-l-4 border-[#F5A201] p-3 mt-4 mb-5 text-left rounded-r-lg shadow-sm">
                    <p className="text-xs text-[#013C58] font-medium leading-relaxed flex items-start gap-1.5">
                      <span className="text-sm">⚠️</span> 
                      <span>
                        <strong>กฎกติกาก๊วน:</strong> หากลงชื่อแล้วไม่สามารถมาตีได้ กรุณากดยกเลิกก่อนเวลาตีจริงอย่างน้อย 1 ชั่วโมง <u>หากไม่ยกเลิกระบบจะคิดเงินทันที</u> และจะมีผลต่อการจองคิวครั้งถัดไป (ต้องเคลียร์ยอดค้างชำระก่อนลงชื่อใหม่ทุกครั้ง)
                      </span>
                    </p>
                  </div>

                  {/* ถ้ายังไม่ได้ลงชื่อ ให้โชว์ Dropdown เลือกล็อกคู่ */}
                  {!isJoined && !isFull && allProfiles.length > 0 && (
                    <div className="mb-4 text-left">
                      <label className="block text-sm font-semibold text-[#00537A] mb-1">อยากจับคู่กับใครเป็นพิเศษไหม? (ตัวเลือก)</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F5A201] transition"
                        value={selectedPartner}
                        onChange={(e) => setSelectedPartner(e.target.value)}
                      >
                        <option value="">-- ไม่ระบุ (ลงคิวเดี่ยว) --</option>
                        {allProfiles.map(profile => (
                          <option key={profile.id} value={profile.id}>
                            {profile.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* แสดงปุ่มตามสถานะ (ลงชื่อแล้ว / คิวเต็ม / กดลงชื่อ) */}
                  {isJoined ? (
                    <div className="space-y-3">
                      <a 
                        href="/checkout" 
                        className="flex items-center justify-center bg-[#FFBA42] text-[#013C58] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#F5A201] hover:text-white transition-all shadow-sm"
                      >
                        💸 เช็คบิล / กลับบ้าน
                      </a>
                      <button 
                        onClick={handleCancelQueue} 
                        className="bg-rose-50 text-rose-500 px-6 py-3 rounded-xl w-full font-bold hover:bg-rose-100 transition-all shadow-sm"
                      >
                        ยกเลิกการลงชื่อ
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleJoinQueue} 
                      disabled={isFull}
                      className={`px-6 py-4 rounded-xl w-full font-bold text-lg transition-all shadow-sm active:scale-95
                        ${isFull 
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                          : "bg-[#00537A] text-white hover:bg-[#013C58] hover:shadow-md"
                        }`}
                    >
                      {isFull ? "คิวเต็มแล้ว 😭" : "ลงชื่อเข้าตีแบด"}
                    </button>
                  )}

                  {/* 🌟 ปุ่มดูกระดานคิว ใช้สีส้มแบรนด์ตัดให้เด่น */}
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <a href="/queue" className="flex items-center justify-center bg-[#013458] text-[#A8E8F9] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#FFBA42] transition-all shadow-sm active:scale-95">
                      📋 กระดานจัดคิว
                    </a>
                  </div>
                </>
              ) : (
                <div className="py-4">
                  <p className="text-slate-500 font-medium">วันนี้แอดมินยังไม่เปิดก๊วนครับ 😴</p>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="text-rose-400 font-medium text-sm hover:text-rose-600 transition mt-2">
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <button onClick={handleLogin} className="bg-[#00B900] text-white px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#009900] transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95">
            เข้าสู่ระบบด้วย LINE
          </button>
        )}
      </div>
    </div>
  );
}
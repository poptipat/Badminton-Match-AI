"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [sessionToday, setSessionToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [playerCount, setPlayerCount] = useState(0); 
  const [allProfiles, setAllProfiles] = useState<any[]>([]); 
  const [selectedPartner, setSelectedPartner] = useState<string>(""); 

  const [myRecord, setMyRecord] = useState<any>(null); 
  const [isAdmin, setIsAdmin] = useState(false); 

  // 🌟 State สำหรับเก็บข้อมูลหนี้ที่ค้างข้ามวัน
  const [outstandingDebt, setOutstandingDebt] = useState<any>(null);

  useEffect(() => {
    checkUserAndSession();
  }, []);

  const checkUserAndSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      
      if (!profile) {
        window.location.href = "/setup-profile";
        return; 
      }

      if (profile?.is_admin) setIsAdmin(true);
     
      // 🌟 1. ระบบเช็กหนี้ค้างชำระจากก๊วนรอบก่อนๆ
      const { data: debts } = await supabase
        .from("session_participants")
        .select(`*, daily_sessions!inner(id, is_active)`)
        .eq("profile_id", user.id)
        .eq("daily_sessions.is_active", false) 
        .in("payment_status", ["unpaid", "pending"]);

      if (debts && debts.length > 0) {
        const realDebt = debts.find(d => (d.total_amount_due + (d.accumulated_shuttle_fee || 0)) > 0);
        if (realDebt) {
          setOutstandingDebt(realDebt);
          setLoading(false);
          return; 
        }
      }

      // 🌟 2. ดึงข้อมูลก๊วนของวันนี้มาแสดง
      const { data: session } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("is_active", true)
        .single();
      
      if (session) {
        setSessionToday(session);

        // 🌟 แก้ไข: นับจำนวนคนที่ "จองโควต้า" ทั้งหมดในวันนี้ (ไม่สนสถานะคิว) เพื่อเช็กโควต้า max_players
        const { count } = await supabase
          .from("session_participants")
          .select("*", { count: 'exact', head: true })
          .eq("session_id", session.id);
        
        setPlayerCount(count || 0);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .neq("id", user.id);
        
        setAllProfiles(profiles || []);

        const { data: myData } = await supabase
          .from("session_participants")
          .select("*")
          .eq("session_id", session.id)
          .eq("profile_id", user.id)
          .single();
        
        setMyRecord(myData || null);
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
    setIsAdmin(false);
    setMyRecord(null);
    setOutstandingDebt(null); 
  };

  // 🌟 ฟังก์ชันที่ 1: จองโควต้า (แต่อยู่สถานะ resting ยังไม่เข้าคิว)
  const handleReserveSlot = async () => {
    if (!sessionToday || !user) return;
    
    const { error } = await supabase
      .from("session_participants")
      .insert({
        session_id: sessionToday.id,
        profile_id: user.id,
        preferred_partner_id: null,
        payment_status: "unpaid",
        queue_status: "resting", // <--- ให้พักรอก่อน ยังไม่เข้ากระดาน
        total_amount_due: sessionToday.court_fee_flat 
      });

    if (!error) {
      alert("✅ จองโควต้าสำเร็จ! เมื่อเดินทางมาถึงคอร์ดแล้ว อย่าลืมมากดปุ่ม 'ลงคิวรอตี' นะครับ 🏸");
      checkUserAndSession(); 
    }
  };

  // 🌟 ฟังก์ชันที่ 2: มาถึงแล้ว พร้อมตี (เปลี่ยนสถานะเข้าคิว waiting)
  const handleReadyToPlay = async () => {
    if (!myRecord) return;

    const { error } = await supabase
      .from("session_participants")
      .update({ 
        queue_status: 'waiting', 
        preferred_partner_id: selectedPartner || null 
      })
      .eq("id", myRecord.id);

    if (!error) {
      alert("🔥 ลงคิวเรียบร้อย! เตรียมตัววอร์มร่างกายได้เลยครับ");
      checkUserAndSession(); 
    }
  };

  // 🌟 ฟังก์ชันที่ 3: ขอพักกินน้ำ (ออกจากคิวชั่วคราว)
  const handleRest = async () => {
    if (!myRecord) return;
    await supabase.from("session_participants").update({ queue_status: 'resting', preferred_partner_id: null }).eq("id", myRecord.id);
    checkUserAndSession();
  };

  // 🌟 ฟังก์ชันที่ 4: ยกเลิกการจอง
  const handleCancelReservation = async () => {
    if (!sessionToday || !myRecord) return;

    const now = new Date();
    const sessionStart = sessionToday.start_time ? new Date(sessionToday.start_time) : null;
    let diffHours = 999; 

    if (sessionStart) {
      diffHours = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    if (diffHours >= 1 || !sessionStart) {
      // ยกเลิกทัน (ก่อน 1 ชม.) -> ลบข้อมูลทิ้ง ฟรี!
      if (!confirm("คุณกดยกเลิกก่อนเวลา 1 ชั่วโมง ระบบจะคืนโควต้าให้โดยไม่คิดค่าสนาม ยืนยันการยกเลิกหรือไม่?")) return;
      await supabase.from("session_participants").delete().eq("id", myRecord.id);
      alert("ยกเลิกการจองเรียบร้อยแล้ว หวังว่าจะมาเล่นด้วยกันรอบหน้านะครับ!");
      setMyRecord(null);
    } else {
      // ยกเลิกไม่ทัน -> ไม่ลบข้อมูล ปล่อยเป็นหนี้
      alert("⚠️ ไม่สามารถยกเลิกฟรีได้แล้วครับ (กระชั้นชิดเกินไป)\nระบบจะบันทึกค่าสนาม 50 บาทตามกติกา แต่หากคุณเปลี่ยนใจมาที่คอร์ด คุณยังสามารถกดลงคิวเพื่อเข้าเล่นได้ตามปกติครับ");
    }
    
    checkUserAndSession(); 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold">กำลังโหลดข้อมูล...</div>;

  // 🔴 โหมดหน้าจอคนติดหนี้
  if (outstandingDebt) {
    const debtAmount = outstandingDebt.total_amount_due + (outstandingDebt.accumulated_shuttle_fee || 0);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans p-4 relative">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-200 text-center max-w-md w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-rose-500"></div>
          <span className="text-6xl block mb-4">🚨</span>
          <h1 className="text-2xl font-black mb-2 text-rose-600">มียอดค้างชำระ</h1>
          <p className="text-slate-600 font-medium mb-6">คุณไม่สามารถลงชื่อก๊วนรอบใหม่ได้<br/>จนกว่าจะชำระยอดที่ค้างอยู่ของรอบก่อนครับ</p>
          
          <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 mb-6">
            <p className="text-sm text-rose-500 font-bold mb-1">ยอดค้างชำระรวม</p>
            <p className="text-4xl font-black text-rose-600">{debtAmount} ฿</p>
            {outstandingDebt.payment_status === 'pending' && (
              <p className="text-xs text-orange-500 font-bold mt-2 bg-orange-100 py-1 rounded-md">⏳ ส่งสลิปแล้ว แอดมินกำลังตรวจสอบ</p>
            )}
          </div>

          <a href="/checkout" className="flex items-center justify-center bg-rose-500 text-white px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-rose-600 transition shadow-md active:scale-95 mb-4">
            💳 ไปหน้าชำระเงิน
          </a>

          {isAdmin && (
            <a href="/admin/payments" className="flex items-center justify-center bg-slate-800 text-white px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-slate-900 transition shadow-md active:scale-95 mb-4 border border-slate-700">
              👑 ไปหน้าตรวจสลิป (ฉุกเฉิน)
            </a>
          )}

          <button onClick={handleLogout} className="text-slate-400 font-medium text-sm hover:text-slate-600 transition">ออกจากระบบ</button>
        </div>
      </div>
    );
  }

  // 🟢 โหมดปกติ
  const isFull = sessionToday && playerCount >= sessionToday.max_players;
  const todayDateFormatted = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  // ตรวจสอบสถานะว่า "อยู่ในคิวรอตี/ตีอยู่" หรือไม่
  const isActiveInQueue = myRecord && ['waiting', 'preparing', 'playing'].includes(myRecord.queue_status);
  // ตรวจสอบว่าเคยจองโควต้าไว้ไหม
  const hasReserved = myRecord !== null;
  // ตรวจสอบว่าเคยลงสนามไปแล้วหรือยัง (เพื่อไม่ให้กดยกเลิกการจองได้อีกถ้าตีไปแล้ว)
  const hasPlayed = (myRecord?.games_played_today || 0) > 0;

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
              className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-[#00537A] object-cover shadow-sm" 
            />
            <h2 className="text-2xl font-bold mb-2 text-[#013C58]">{user.user_metadata.name}</h2>
            
            <div className="bg-slate-50 rounded-2xl p-5 my-6 border border-slate-200">
              {sessionToday ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="relative flex h-3 w-3">
                      {!isFull && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                    </span>
                    <h3 className="text-[#00537A] font-bold text-lg">
                      {isFull ? "โควต้าวันนี้เต็มแล้ว!" : `เปิดก๊วน ${todayDateFormatted}`}
                    </h3>
                  </div>
                  
                  {sessionToday.start_time && sessionToday.end_time && (
                    <div className="bg-white border border-[#A8E8F9] rounded-xl py-2 px-4 mb-4 inline-block shadow-sm">
                      <p className="text-[#013C58] font-bold text-sm">
                        ⏰ เวลา: {formatTime(sessionToday.start_time)} - {formatTime(sessionToday.end_time)}
                      </p>
                    </div>
                  )}
                  
                  <p className="text-sm text-slate-600 font-medium mt-1">ค่าสนามเหมา {sessionToday.court_fee_flat} บ. | ค่าลูก {sessionToday.base_shuttle_fee} บ./เกม</p>
                  
                  {/* เปลี่ยนคำอธิบายให้เข้าใจว่านี่คือยอดการจองโควต้า */}
                  <p className={`text-sm mt-1 mb-4 font-bold ${isFull ? 'text-rose-500' : 'text-[#F5A201]'}`}>
                    ยอดการจองโควต้า: {playerCount} / {sessionToday.max_players} คน
                  </p>

                  <div className="bg-[#FFFBF0] border-l-4 border-[#F5A201] p-3 mt-4 mb-5 text-left rounded-r-lg shadow-sm">
                    <p className="text-xs text-[#013C58] font-medium leading-relaxed flex items-start gap-1.5">
                      <span className="text-sm">⚠️</span> 
                      <span>
                        <strong>กติกา:</strong> กดยกเลิกการจอง <u>ก่อน 1 ชม.</u> (ฟรี) หากยกเลิกกระชั้นชิด ระบบจะคิดค่าสนามเหมาจ่าย 50 บาทครับ
                      </span>
                    </p>
                  </div>

                  {/* 🌟 แสดงส่วนเลือกคู่เฉพาะตอนที่เตรียมจะกดเข้าคิว (อยู่หน้าคอร์ดแล้ว) */}
                  {hasReserved && !isActiveInQueue && (
                    <div className="mb-4 text-left p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                      <label className="block text-sm font-semibold text-emerald-700 mb-2">ถึงคอร์ดแล้ว! อยากจับคู่กับใครไหม?</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
                  
                  {/* 🌟 ลอจิกการแสดงปุ่มแบบใหม่ */}
                  {!hasReserved ? (
                    // กรณียังไม่เคยจองสิทธิ์เลย
                    <button 
                      onClick={handleReserveSlot} 
                      disabled={isFull}
                      className={`px-6 py-4 rounded-xl w-full font-bold text-lg transition-all shadow-sm active:scale-95
                        ${isFull 
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                          : "bg-[#00537A] text-white hover:bg-[#013C58] hover:shadow-md"
                        }`}
                    >
                      {isFull ? "คิวเต็มแล้ว 😭" : "🎟️ จองโควต้าตีแบดวันนี้"}
                    </button>
                  ) : (
                    // กรณีจองโควต้าแล้ว
                    <div className="space-y-3">
                      
                      {isActiveInQueue ? (
                        // ถ้าอยู่ในคิว (รอตี / เตรียมตัว / ตีอยู่)
                        <button 
                          onClick={handleRest} 
                          className="bg-amber-50 text-amber-600 px-6 py-4 rounded-xl w-full font-bold hover:bg-amber-100 transition-all shadow-sm active:scale-95 border border-amber-200"
                        >
                          ⏸️ พักคิวชั่วคราว
                        </button>
                      ) : (
                        // ถ้าจองแล้ว แต่ยังไม่เข้าคิว (อยู่ระหว่างเดินทาง หรือ พักอยู่)
                        <div className="space-y-3">
                          <button 
                            onClick={handleReadyToPlay} 
                            className="bg-emerald-500 text-white px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-emerald-600 transition-all shadow-md active:scale-95 border-b-4 border-emerald-700"
                          >
                            🏸 ถึงคอร์ดแล้ว! ลงคิวพร้อมตี
                          </button>
                          
                          {/* ปุ่มยกเลิกโควต้า (แสดงเฉพาะคนที่ยังไม่เคยลงตีในวันนั้นเลย) */}
                          {!hasPlayed && (
                            <button 
                              onClick={handleCancelReservation} 
                              className="text-slate-400 text-sm font-semibold underline hover:text-rose-500 transition-all mt-2"
                            >
                              ยกเลิกการจองโควต้าวันนี้
                            </button>
                          )}
                        </div>
                      )}

                      {/* ปุ่มเช็คบิล แสดงเสมอถ้ายังไม่จ่ายเงิน */}
                      {myRecord.payment_status !== 'paid' && (
                        <a 
                          href="/checkout" 
                          className="flex items-center justify-center bg-[#FFBA42] text-[#013C58] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#F5A201] hover:text-white transition-all shadow-sm mt-4 border border-[#F5A201]"
                        >
                          💸 เช็คบิล / กลับบ้าน
                        </a>
                      )}
                    </div>
                  )}

                  <div className="mt-6 border-t border-slate-200 pt-5 space-y-3">
                    <a href="/queue" className="flex items-center justify-center bg-[#013458] text-[#A8E8F9] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#FFBA42] hover:text-[#013C58] transition-all shadow-sm active:scale-95">
                      📋 กระดานจัดคิว
                    </a>

                    {isAdmin && (
                      <a href="/admin" className="flex items-center justify-center bg-[#013458] text-[#F5A201] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#00537A] transition-all shadow-sm active:scale-95 border border-[#FFBA42]/30">
                        👑 เข้าสู่ระบบแอดมิน
                      </a>
                    )}
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
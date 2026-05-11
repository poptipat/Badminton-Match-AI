"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminSettings() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(16);
  const [courtFee, setCourtFee] = useState(50);
  const [shuttleFee, setShuttleFee] = useState(27);
  
  // 🌟 State ใหม่: เลือกระบบการจอง
  const [reservationType, setReservationType] = useState("pay_later");

  useEffect(() => {
    checkAdminAndFetchSession();
  }, []);

  const checkAdminAndFetchSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (profile?.is_admin) {
        setIsAdmin(true);
        fetchCurrentSession();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const toLocalDatetimeInput = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16); 
  };

  const fetchCurrentSession = async () => {
    // 🌟 1. พยายามดึงก๊วนที่ "กำลังเปิดอยู่" มาก่อน
    let { data: session } = await supabase
      .from("daily_sessions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 🌟 2. ถ้าไม่มีก๊วนเปิดอยู่เลย ให้ไปดึงก๊วนล่าสุดในอดีตมาเป็น Template
    if (!session) {
      const { data: lastSession } = await supabase
        .from("daily_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      session = lastSession;
    }

    if (session) {
      // โหลดการตั้งค่าตัวเลข (จำค่าเดิมเสมอ!)
      setMaxPlayers(session.max_players || 16);
      setCourtFee(session.court_fee_flat || 50);
      setShuttleFee(session.base_shuttle_fee || 27);
      setReservationType(session.reservation_type || "pay_later");

      // เช็คสถานะเพื่อเปิด/ปิด สวิตช์
      if (session.is_active) {
        setSessionId(session.id);
        setIsActive(true); // สวิตช์สีเขียว
        setStartTime(toLocalDatetimeInput(session.start_time));
        setEndTime(toLocalDatetimeInput(session.end_time));
      } else {
        setSessionId(null);
        setIsActive(false); // สวิตช์สีเทา
        setStartTime("");
        setEndTime("");
      }
    }
    setLoading(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const startIso = startTime ? new Date(startTime).toISOString() : null;
    const endIso = endTime ? new Date(endTime).toISOString() : null;

    const sessionData = {
      is_active: isActive,
      start_time: startIso,
      end_time: endIso,
      max_players: maxPlayers,
      court_fee_flat: courtFee,
      base_shuttle_fee: shuttleFee,
      reservation_type: reservationType,
    };

    // 🌟 ท่าไม้ตาย: เช็คฐานข้อมูลเดี๋ยวนั้นเลยว่ามีก๊วนเปิดอยู่ไหม! (ไม่พึ่งตัวแปร State)
    const { data: existingActive } = await supabase
      .from("daily_sessions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (existingActive) {
      // ถ้ามีก๊วนเปิดอยู่แล้ว -> บังคับ "อัปเดต" เท่านั้น ห้ามสร้างก๊วนซ้อน!
      const { error } = await supabase.from("daily_sessions").update(sessionData).eq("id", existingActive.id);
      if (error) alert("บันทึกไม่สำเร็จ: " + error.message);
      else alert("✅ อัปเดตการตั้งค่าก๊วนปัจจุบันเรียบร้อยแล้ว!");
    } else {
      // ถ้าไม่มีก๊วนเปิดอยู่เลย -> ค่อย "สร้างก๊วนใหม่"
      const { error } = await supabase.from("daily_sessions").insert([sessionData]);
      if (error) alert("สร้างก๊วนใหม่ไม่สำเร็จ: " + error.message);
      else alert("✅ เปิดก๊วนใหม่รอบใหม่เรียบร้อยแล้ว!");
    }
    
    fetchCurrentSession();
    setSaving(false);
  };

  const handleCloseSession = async () => {
    if (!confirm("⚠️ แน่ใจหรือไม่ที่จะ 'ปิดก๊วน' ตอนนี้? (ระบบจะล็อกคิวและเคลียร์ยอด)")) return;
    setSaving(true);
    
    // 🌟 ท่ากวาดล้าง: บังคับปิด "ทุกก๊วน" ที่ค้างเป็น TRUE อยู่ให้กลายเป็น FALSE ทั้งหมด!
    const { error } = await supabase.from("daily_sessions").update({ is_active: false }).eq("is_active", true);
    
    if (error) {
      alert("ปิดก๊วนไม่สำเร็จ: " + error.message);
    } else {
      setIsActive(false);
      setSessionId(null);
      alert("ปิดก๊วนเรียบร้อยแล้วครับ! 🎉");
      fetchCurrentSession();
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-yellow-400 font-bold text-xl">กำลังโหลดระบบตั้งค่า...</div>;

  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white p-4 text-center">
      <span className="text-6xl mb-4">⛔</span>
      <h1 className="text-2xl font-bold text-red-500 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
      <Link href="/" className="bg-gray-800 px-6 py-2 rounded-xl hover:bg-gray-700 transition">กลับหน้าหลัก</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-gray-100 flex items-center gap-2">
            <span className="text-yellow-500">⚙️</span> ตั้งค่าก๊วนประจำวัน
          </h1>
          <Link href="/admin" className="w-full md:w-auto bg-gray-800 border border-gray-700 text-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-700 transition shadow-md font-bold text-center text-sm md:text-base">
            🔙 กลับหน้าจัดคอร์ด
          </Link>
        </div>

        <div className="bg-gray-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-800">
          <div className="flex items-center justify-between mb-8 bg-gray-950 p-4 rounded-2xl border border-gray-800">
            <div>
              <h2 className="text-lg font-bold text-white">สถานะก๊วนวันนี้</h2>
              <p className="text-sm text-gray-500">{isActive ? "เปิดรับสมัครลงคิวแล้ว" : "ยังไม่ได้เปิดก๊วน"}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isActive} onChange={() => setIsActive(!isActive)} />
              <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* 🌟 ส่วนที่เพิ่มใหม่: เลือกระบบการจอง */}
            <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
              <label className="block text-base font-bold text-yellow-400 mb-3">เลือกระบบกติกาการจองโควต้า</label>
              <div className="flex flex-col gap-3">
                <label className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${reservationType === 'pay_later' ? 'border-yellow-500 bg-gray-800 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-gray-700 bg-gray-900 opacity-70 hover:opacity-100'}`}>
                  <input type="radio" className="hidden" checked={reservationType === 'pay_later'} onChange={() => setReservationType('pay_later')} />
                  <p className="font-bold text-white text-lg flex items-center gap-2"><span className="text-xl">⏳</span> ระบบจ่ายทีหลัง (Pay Later)</p>
                  <p className="text-sm text-gray-400 mt-1 pl-7">ยกเลิกก่อน 1 ชม. ฟรี / ยกเลิกกระชั้นชิดคิดค่าปรับ (ค่าเหมาสนาม)</p>
                </label>
                <label className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${reservationType === 'pay_first' ? 'border-emerald-500 bg-emerald-900/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-gray-700 bg-gray-900 opacity-70 hover:opacity-100'}`}>
                  <input type="radio" className="hidden" checked={reservationType === 'pay_first'} onChange={() => setReservationType('pay_first')} />
                  <p className="font-bold text-emerald-400 text-lg flex items-center gap-2"><span className="text-xl">💸</span> ระบบบังคับโอนก่อน (Pay First)</p>
                  <p className="text-sm text-gray-400 mt-1 pl-7">ต้องโอนค่าเหมาสนามล่วงหน้าทันที ถึงจะจองโควต้าสำเร็จ</p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">เวลาเปิดรับคิว / เริ่มตี</label>
                <input type="datetime-local" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">เวลาจบก๊วน</label>
                <input type="datetime-local" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">รับคนสูงสุด (คน)</label>
                <input type="number" required min="4" max="100" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition text-2xl font-black text-center" />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">ค่าสนามเหมาจ่าย (บาท)</label>
                  <input type="number" required min="0" value={courtFee} onChange={(e) => setCourtFee(Number(e.target.value))} className="w-full bg-gray-800 text-emerald-400 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-bold" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2">ค่าลูกแบด (บาท/เกม)</label>
                  <input type="number" required min="0" value={shuttleFee} onChange={(e) => setShuttleFee(Number(e.target.value))} className="w-full bg-gray-800 text-emerald-400 border border-gray-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-bold" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800 flex flex-col md:flex-row gap-4">
              <button type="submit" disabled={saving} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-4 rounded-xl transition shadow-md text-lg active:scale-95 disabled:bg-gray-600 disabled:cursor-not-allowed">
                {saving ? "กำลังบันทึก..." : "💾 บันทึกและอัปเดตระบบ"}
              </button>

              {isActive && sessionId && (
                <button type="button" onClick={handleCloseSession} className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 font-bold py-4 px-6 rounded-xl transition md:w-auto w-full active:scale-95">
                  ปิดก๊วนวันนี้
                </button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
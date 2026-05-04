"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPayments() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 State สำหรับสรุปยอดเงิน
  const [summary, setSummary] = useState({
    totalExpected: 0,
    totalCollected: 0,
    totalPending: 0,
    totalUnpaid: 0,
    totalGames: 0
  });

  useEffect(() => {
    fetchPayments();
    
    const subscription = supabase
      .channel('payment_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, fetchPayments)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchPayments = async () => {
    // 🌟 ดึงข้อมูลบิลทั้งหมดที่สถานะไม่ใช่ paid (คือค้างจ่ายหรือรอตรวจ) จากทุกๆ ก๊วน
    // และดึงข้อมูลทุกคนในก๊วนของวันนี้ (เผื่อมีคนตีอยู่แต่ยังไม่ได้จ่าย)
    
    // 1. หาก๊วนที่กำลังเปิดอยู่ (ถ้ามี)
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    const currentSessionId = session ? session.id : null;

    // 2. ดึงข้อมูล 2 ส่วน:
    // - คนที่มีบิลค้าง (pending, unpaid, resting) ไม่ว่าก๊วนไหน
    // - คนที่อยู่ในก๊วนวันนี้ (ไม่ว่าจะสถานะอะไร)
    
    let query = supabase
      .from("session_participants")
      .select(`
        id, 
        payment_status, 
        payment_slip_url, 
        total_amount_due, 
        accumulated_shuttle_fee,
        games_played_today,
        session_id,
        profiles!profile_id(display_name, avatar_url)
      `)
      .order("checkout_time", { ascending: false });

    // ถ้ามีก๊วนวันนี้ ให้ดึงรวมกัน ถ้าไม่มี ดึงเฉพาะคนที่ค้างจ่าย
    if (currentSessionId) {
       query = query.or(`payment_status.in.(pending,unpaid,resting),session_id.eq.${currentSessionId}`);
    } else {
       query = query.in("payment_status", ["pending", "unpaid", "resting"]);
    }

    const { data } = await query;
        
    if (data) {
      setParticipants(data);
      
      // 🌟 คำนวณสรุปยอด (คำนวณเฉพาะบิลที่ค้าง + บิลของวันนี้)
      let expected = 0, collected = 0, pendingAmt = 0, unpaidAmt = 0, games = 0;
      
      data.forEach(p => {
        // คิดยอดรวมเฉพาะก๊วนวันนี้ หรือ ก๊วนเก่าที่ยังไม่ได้จ่าย
        if (p.session_id === currentSessionId || p.payment_status !== 'paid') {
           const totalFee = (p.total_amount_due || 0) + (p.accumulated_shuttle_fee || 0);
           
           // ไม่รวมยอด 0 บาทของก๊วนเก่า (เช่น คนที่กดลงชื่อแล้วยกเลิกก่อนเวลา)
           if (totalFee > 0) {
               expected += totalFee;
               
               // นับเกมเฉพาะของวันนี้ หรือคนที่ค้างจ่าย
               games += (p.games_played_today || 0);

               if (p.payment_status === 'paid') collected += totalFee;
               else if (p.payment_status === 'pending') pendingAmt += totalFee;
               else unpaidAmt += totalFee; // สถานะ unpaid หรือ resting
           }
        }
      });

      setSummary({
        totalExpected: expected,
        totalCollected: collected,
        totalPending: pendingAmt,
        totalUnpaid: unpaidAmt,
        totalGames: games
      });
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const confirmApprove = confirm("คุณตรวจสอบยอดเงินในบัญชีว่าเข้าจริงแล้ว ใช่หรือไม่?");
    if (!confirmApprove) return;

    await supabase
      .from("session_participants")
      .update({ payment_status: 'paid' })
      .eq('id', id);
      
    fetchPayments();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-yellow-500 font-bold text-xl">กำลังโหลดระบบการเงิน...</div>;

  const pending = participants.filter(p => p.payment_status === 'pending');
  const paid = participants.filter(p => p.payment_status === 'paid');
  const unpaid = participants.filter(p => p.payment_status === 'unpaid' || p.payment_status === 'resting');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* 🌟 Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-800 pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-gray-100 flex items-center gap-2">
            <span className="text-emerald-500">💰</span> ระบบตรวจสลิป & บัญชี
          </h1>
          <Link href="/admin" className="w-full md:w-auto bg-gray-800 border border-gray-700 text-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-700 transition shadow-md font-bold text-center text-sm md:text-base">
            🔙 กลับหน้าจัดคอร์ด
          </Link>
        </div>

        {/* 🌟 Dashboard สรุปยอดรายวัน */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-sm text-center">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">ยอดรวมที่ต้องได้</p>
            <p className="text-2xl md:text-3xl font-black text-white">{summary.totalExpected} <span className="text-sm font-medium text-gray-500">฿</span></p>
          </div>
          <div className="bg-emerald-900/20 rounded-2xl p-4 border border-emerald-500/30 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">รับเงินแล้ว (Paid)</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-400">{summary.totalCollected} <span className="text-sm font-medium text-emerald-600">฿</span></p>
          </div>
          <div className="bg-rose-900/20 rounded-2xl p-4 border border-rose-500/30 shadow-sm text-center">
            <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">ค้างชำระ (Unpaid)</p>
            <p className="text-2xl md:text-3xl font-black text-rose-400">{summary.totalUnpaid + summary.totalPending} <span className="text-sm font-medium text-rose-600">฿</span></p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-sm text-center">
            <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">ตีไปทั้งหมด</p>
            <p className="text-2xl md:text-3xl font-black text-indigo-400">{summary.totalGames} <span className="text-sm font-medium text-indigo-600">เกม</span></p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* 🌟 คอลัมน์ซ้าย: รอตรวจสอบ & ค้างชำระ */}
          <div className="space-y-6">
            
            {/* โซนรอยืนยัน (สีส้ม) */}
            <div className="bg-orange-900/10 rounded-3xl p-5 md:p-6 shadow-xl border border-orange-500/30">
              <h2 className="text-lg md:text-xl font-bold text-orange-400 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="bg-orange-500/20 p-1.5 rounded-lg">⏳</span> รอตรวจสอบสลิป</span>
                <span className="text-sm bg-orange-500/20 px-3 py-1 rounded-full">{pending.length} รายการ</span>
              </h2>
              
              {pending.length === 0 ? <p className="text-gray-500 py-4 text-center text-sm">ไม่มีสลิปใหม่</p> : (
                <div className="space-y-4">
                  {pending.map(p => {
                    const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                    return (
                      <div key={p.id} className="bg-gray-900 p-4 rounded-2xl border border-orange-500/50 flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=random`} className="w-10 h-10 rounded-full object-cover border border-gray-700" alt="profile" />
                            <div>
                              <p className="font-bold text-gray-200">{p.profiles?.display_name}</p>
                              <p className="text-xs text-gray-400">ตีไป: {p.games_played_today || 0} เกม</p>
                            </div>
                          </div>
                          <p className="text-lg text-yellow-500 font-black">{total} ฿</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {p.payment_slip_url ? (
                            <a href={p.payment_slip_url} target="_blank" rel="noreferrer" className="text-center bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 text-sm font-bold py-2.5 rounded-xl transition">
                              🔍 ดูสลิป
                            </a>
                          ) : (
                            <div className="text-center bg-gray-800 border border-gray-700 text-gray-600 text-sm font-bold py-2.5 rounded-xl cursor-not-allowed">
                              ไม่มีรูปสลิป
                            </div>
                          )}
                          <button 
                            onClick={() => handleApprove(p.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition shadow-md active:scale-95"
                          >
                            ✅ ยืนยันยอด
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* โซนค้างชำระ (สียแดง/เทา) */}
            <div className="bg-gray-900/50 rounded-3xl p-5 md:p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-gray-400 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="bg-gray-800 p-1.5 rounded-lg">🏃</span> ยังไม่จ่าย (รอกลับบ้าน)</span>
                <span className="text-sm bg-gray-800 px-3 py-1 rounded-full">{unpaid.length} คน</span>
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {unpaid.length === 0 ? <p className="text-gray-600 text-center py-4 text-sm">เคลียร์บิลหมดแล้ว</p> : (
                  unpaid.map(p => {
                    const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-950 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-3">
                          <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=random`} className="w-8 h-8 rounded-full object-cover grayscale opacity-70" alt="profile" />
                          <p className="font-medium text-gray-400 text-sm">{p.profiles?.display_name}</p>
                        </div>
                        <span className="text-rose-400 font-bold text-sm">{total} ฿</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>

          {/* 🌟 คอลัมน์ขวา: จ่ายแล้ว */}
          <div>
            <div className="bg-emerald-900/10 rounded-3xl p-5 md:p-6 shadow-sm border border-emerald-500/20 h-full">
              <h2 className="text-lg md:text-xl font-bold text-emerald-400 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg">✅</span> รับเงินเรียบร้อย</span>
                <span className="text-sm bg-emerald-500/20 px-3 py-1 rounded-full">{paid.length} รายการ</span>
              </h2>
              <div className="space-y-3">
                {paid.length === 0 ? <p className="text-emerald-900 text-center py-8 text-sm">ยังไม่มีรายการ</p> : (
                  paid.map(p => {
                     const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                     return (
                      <div key={p.id} className="flex items-center justify-between p-3.5 bg-gray-900 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/30 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name}&background=random`} className="w-9 h-9 rounded-full object-cover border border-gray-700 flex-shrink-0" alt="profile" />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-200 truncate text-sm">{p.profiles?.display_name}</p>
                            <p className="text-[10px] text-emerald-500 font-medium">จ่ายแล้ว</p>
                          </div>
                        </div>
                        <span className="text-emerald-400 font-black whitespace-nowrap bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-500/20">{total} ฿</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
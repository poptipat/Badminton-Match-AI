"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPayments() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
    
    // อัปเดตแบบ Real-time เผื่อมีคนโอนเงินเข้ามาตอนกำลังเปิดหน้าจอ
    const subscription = supabase
      .channel('payment_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, fetchPayments)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchPayments = async () => {
    const { data: session } = await supabase.from("daily_sessions").select("id").eq("is_active", true).single();
    
    if (session) {
      // ดึงเฉพาะคนที่กด "ส่งสลิปแล้ว (pending)" หรือ "จ่ายแล้ว (paid)"
      const { data } = await supabase
        .from("session_participants")
        .select(`
          id, 
          payment_status, 
          payment_slip_url, 
          total_amount_due, 
          accumulated_shuttle_fee,
          profiles!profile_id(display_name, avatar_url)
        `)
        .eq("session_id", session.id)
        .in("payment_status", ["pending", "paid"])
        .order("checkout_time", { ascending: false }); // เรียงคนที่เพิ่งส่งสลิปขึ้นก่อน
        
      setParticipants(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const confirmApprove = confirm("คุณตรวจสอบยอดเงินถูกต้องแล้วใช่หรือไม่?");
    if (!confirmApprove) return;

    await supabase
      .from("session_participants")
      .update({ payment_status: 'paid' })
      .eq('id', id);
      
    fetchPayments();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#013C58] text-[#FFBA42] font-bold text-xl">กำลังโหลดรายการโอนเงิน...</div>;

  const pending = participants.filter(p => p.payment_status === 'pending');
  const paid = participants.filter(p => p.payment_status === 'paid');

  return (
    <div className="min-h-screen bg-[#013C58] text-white p-4 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* 🌟 Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#00537A] pb-5 gap-4">
          <h1 className="text-2xl md:text-3xl font-black text-[#FFBA42] drop-shadow-md">💰 ตรวจสอบการโอนเงิน</h1>
          <Link href="/admin" className="w-full md:w-auto bg-[#00537A] border border-[#A8E8F9]/30 text-[#A8E8F9] px-4 py-2.5 rounded-xl hover:bg-[#00537A]/80 transition shadow-md font-bold text-center text-sm md:text-base">
            🔙 กลับหน้าจัดคอร์ด
          </Link>
        </div>

        <div className="space-y-6">
          {/* 🌟 โซนรอยืนยัน (ไฮไลท์ด้วยสีส้ม CI) */}
          <div className="bg-[#00537A]/40 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-xl border border-[#F5A201]/50">
            <h2 className="text-lg md:text-xl font-bold text-[#F5A201] mb-4 flex items-center gap-2">
              <span className="bg-[#F5A201]/20 p-2 rounded-lg">⏳</span> รอการตรวจสอบ ({pending.length} รายการ)
            </h2>
            
            {pending.length === 0 ? <p className="text-[#A8E8F9]/60 py-4 text-center text-sm md:text-base">ยังไม่มีรายการโอนเงินใหม่</p> : (
              <div className="grid md:grid-cols-2 gap-4">
                {pending.map(p => {
                  const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                  return (
                    <div key={p.id} className="bg-[#013C58] p-4 rounded-2xl border border-[#F5A201]/30 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=F5A201&color=013C58`} className="w-12 h-12 rounded-full object-cover border-2 border-[#F5A201]/50 flex-shrink-0" alt="profile" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-base md:text-lg truncate">{p.profiles?.display_name}</p>
                          <p className="text-sm text-[#FFD35B] font-semibold mt-0.5">ยอดโอน: {total} บาท</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2.5 mt-2">
                        {p.payment_slip_url && (
                          <a href={p.payment_slip_url} target="_blank" rel="noreferrer" className="block text-center bg-[#A8E8F9]/10 border border-[#A8E8F9]/30 hover:bg-[#A8E8F9]/20 text-[#A8E8F9] text-sm font-bold py-2.5 rounded-xl transition">
                            🔍 ดูรูปสลิป
                          </a>
                        )}
                        <button 
                          onClick={() => handleApprove(p.id)}
                          className="w-full bg-[#F5A201] hover:bg-[#FFBA42] text-[#013C58] font-bold py-3 rounded-xl transition shadow-md active:scale-95"
                        >
                          ✅ ยืนยันรับเงิน
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 🌟 โซนจ่ายแล้ว (ใช้สีฟ้าอ่อน A8E8F9 เพื่อความสบายตา) */}
          <div className="bg-[#00537A]/20 backdrop-blur-md rounded-3xl p-5 md:p-6 shadow-sm border border-[#A8E8F9]/20">
            <h2 className="text-lg md:text-xl font-bold text-[#A8E8F9] mb-4 flex items-center gap-2">
              <span className="bg-[#A8E8F9]/20 p-2 rounded-lg text-white">✅</span> ชำระเงินเรียบร้อย ({paid.length} รายการ)
            </h2>
            <div className="space-y-3">
              {paid.length === 0 ? <p className="text-[#A8E8F9]/50 text-center py-4 text-sm md:text-base">ยังไม่มีข้อมูล</p> : (
                paid.map(p => {
                   const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                   return (
                    <div key={p.id} className="flex items-center justify-between p-3.5 bg-[#013C58] rounded-2xl border border-[#A8E8F9]/10 hover:border-[#A8E8F9]/30 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=A8E8F9&color=013C58`} className="w-9 h-9 rounded-full object-cover border border-[#A8E8F9]/30 flex-shrink-0" alt="profile" />
                        <p className="font-medium text-[#A8E8F9] truncate text-sm md:text-base">{p.profiles?.display_name}</p>
                      </div>
                      <span className="text-white font-bold whitespace-nowrap bg-[#00537A] px-3 py-1 rounded-lg border border-[#A8E8F9]/20">{total} ฿</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
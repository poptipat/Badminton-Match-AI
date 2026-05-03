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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">กำลังโหลดรายการโอนเงิน...</div>;

  const pending = participants.filter(p => p.payment_status === 'pending');
  const paid = participants.filter(p => p.payment_status === 'paid');

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-extrabold text-green-400">💰 ตรวจสอบการโอนเงิน</h1>
          <Link href="/admin" className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
            กลับหน้าจัดคอร์ด
          </Link>
        </div>

        <div className="space-y-6">
          {/* โซนรอยืนยัน (สีเหลือง) */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-yellow-700">
            <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2">
              <span>⏳</span> รอการตรวจสอบ ({pending.length} รายการ)
            </h2>
            
            {pending.length === 0 ? <p className="text-gray-500 py-4">ยังไม่มีรายการโอนเงินใหม่</p> : (
              <div className="grid md:grid-cols-2 gap-4">
                {pending.map(p => {
                  const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                  return (
                    <div key={p.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-4">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-10 h-10 rounded-full object-cover bg-white" alt="profile" />
                        <div>
                          <p className="font-bold">{p.profiles?.display_name}</p>
                          <p className="text-sm text-yellow-400 font-semibold">ยอดโอน: {total} บาท</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {p.payment_slip_url && (
                          <a href={p.payment_slip_url} target="_blank" rel="noreferrer" className="block text-center bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded-lg transition">
                            🔍 ดูรูปสลิป
                          </a>
                        )}
                        <button 
                          onClick={() => handleApprove(p.id)}
                          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition"
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

          {/* โซนจ่ายแล้ว (สีเขียว) */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl border border-gray-800">
            <h2 className="text-xl font-bold text-green-500 mb-4 flex items-center gap-2">
              <span>✅</span> ชำระเงินเรียบร้อย ({paid.length} รายการ)
            </h2>
            <div className="space-y-3">
              {paid.length === 0 ? <p className="text-gray-500">ยังไม่มีข้อมูล</p> : (
                paid.map(p => {
                   const total = p.total_amount_due + (p.accumulated_shuttle_fee || 0);
                   return (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
                      <div className="flex items-center gap-3">
                        <img src={p.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${p.profiles?.display_name || "Unknown"}&background=random`} className="w-8 h-8 rounded-full object-cover bg-white" alt="profile" />
                        <p className="font-medium text-gray-300">{p.profiles?.display_name}</p>
                      </div>
                      <span className="text-green-400 font-bold">{total} บาท</span>
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
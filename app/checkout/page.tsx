"use client";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function CheckoutPage() {
  const [participant, setParticipant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // ⚠️ เปลี่ยนเป็นเบอร์พร้อมเพย์ของคุณได้เลยครับ!
  const PROMPTPAY_NUMBER = "0812345678"; 

  useEffect(() => {
    fetchCheckoutData();
  }, []);

  const fetchCheckoutData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: session } = await supabase.from("daily_sessions").select("id, court_fee_flat").eq("is_active", true).single();

      if (session) {
        const { data: partData, error } = await supabase
          .from("session_participants")
          .select("*, profiles!profile_id(display_name)")
          .eq("session_id", session.id)
          .eq("profile_id", user.id)
          .single();

        if (error) console.error("เกิดข้อผิดพลาด:", error);
        setParticipant(partData);
      }
    }
    setLoading(false);
  };

  const handleUploadSlip = async () => {
    if (!file) return alert("กรุณาแนบรูปสลิปก่อนครับ!");
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${participant.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage.from('slips').upload(filePath, file);

    if (uploadError) {
      alert("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);

    await supabase
      .from("session_participants")
      .update({
        payment_status: "pending", 
        payment_slip_url: publicUrlData.publicUrl,
        checkout_time: new Date().toISOString()
      })
      .eq("id", participant.id);

    alert("✅ ส่งสลิปเรียบร้อย! ขอบคุณที่มาร่วมสนุกกันครับ");
    fetchCheckoutData();
    setUploading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-lg">กำลังโหลดบิลของคุณ...</div>;

  if (!participant) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <p className="text-slate-500 mb-4 font-medium text-lg">คุณยังไม่ได้ลงชื่อในก๊วนวันนี้ครับ</p>
      <Link href="/" className="text-[#013C58] hover:text-[#F5A201] underline font-bold transition">กลับหน้าหลัก</Link>
    </div>
  );

  // 🌟 ลอจิกการคำนวณเงิน
  const gamesCount = participant.games_played_today || 0;
  const totalShuttleFee = gamesCount * 27; 
  const courtFee = 50; 
  const grandTotal = totalShuttleFee + courtFee; 

  const qrCodeUrl = `https://promptpay.io/${PROMPTPAY_NUMBER}/${grandTotal}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans flex items-center justify-center">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        
        {/* หัวบิล (โทน CI น้ำเงิน/เหลือง) */}
        <div className="bg-[#013C58] p-6 text-center text-white">
          <h1 className="text-2xl font-black mb-1 text-[#FFBA42] drop-shadow-sm">💸 สรุปค่าใช้จ่าย</h1>
          <p className="text-[#A8E8F9] font-medium">คุณ {participant.profiles?.display_name}</p>
        </div>

        <div className="p-6">
          <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200">
            <div className="flex justify-between mb-3 text-slate-600 font-medium">
              <span>ค่าสนาม (เหมา)</span>
              <span className="text-[#013C58] font-bold">{courtFee} บาท</span>
            </div>
            <div className="flex justify-between mb-3 text-slate-600 font-medium">
              <span>ค่าลูกแบด ({gamesCount} เกม)</span>
              <span className="text-[#013C58] font-bold">{totalShuttleFee} บาท</span>
            </div>
            <hr className="my-4 border-slate-200" />
            <div className="flex justify-between font-black text-xl text-slate-800 items-end">
              <span>ยอดรวมทั้งสิ้น</span>
              <span className="text-3xl text-[#F5A201]">{grandTotal} <span className="text-lg">บาท</span></span>
            </div>
          </div>

          {/* สถานะการชำระเงิน */}
          {participant.payment_status === 'pending' ? (
            <div className="text-center p-6 bg-[#FFFBF0] rounded-2xl border border-[#F5A201]/30">
              <span className="text-4xl block mb-2">⏳</span>
              <h2 className="text-[#F5A201] font-bold text-lg">ส่งสลิปแล้ว รอตรวจสอบ</h2>
              <p className="text-slate-500 text-sm mt-1">กลับบ้านพักผ่อนได้เลยครับ!</p>
              <Link href="/" className="mt-5 inline-block bg-white border border-slate-200 px-6 py-2 rounded-xl text-slate-600 hover:text-[#013C58] font-semibold transition shadow-sm">กลับหน้าหลัก</Link>
            </div>
          ) : participant.payment_status === 'paid' ? (
            <div className="text-center p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-4xl block mb-2">✅</span>
              <h2 className="text-emerald-600 font-bold text-lg">ชำระเงินเสร็จสมบูรณ์</h2>
              <Link href="/" className="mt-5 inline-block bg-white border border-slate-200 px-6 py-2 rounded-xl text-slate-600 hover:text-[#013C58] font-semibold transition shadow-sm">กลับหน้าหลัก</Link>
            </div>
          ) : (
            // โซนจ่ายเงิน (สแกน QR + อัปสลิป)
            <div className="text-center">
              <p className="text-sm font-bold text-slate-500 mb-3 bg-slate-100 py-1.5 rounded-lg inline-block px-4">สแกน QR Code โอนตรงยอดเป๊ะ!</p>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 inline-block mb-6">
                <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 mx-auto" />
              </div>
              
              <div className="mb-6 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-sm font-bold text-[#013C58] mb-2">แนบสลิปโอนเงิน</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-[#00537A] file:text-white hover:file:bg-[#013C58] file:transition file:cursor-pointer cursor-pointer"
                />
              </div>

              <button 
                onClick={handleUploadSlip}
                disabled={uploading}
                className={`w-full py-4 rounded-xl font-bold text-lg transition shadow-md ${uploading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#F5A201] text-white hover:bg-[#FFBA42] active:scale-95'}`}
              >
                {uploading ? 'กำลังอัปโหลดรูป...' : 'ยืนยันการชำระเงิน'}
              </button>
              
              <Link href="/" className="block mt-4 text-slate-400 font-medium text-sm hover:text-slate-600 transition">
                ยังไม่จ่าย ขอกลับไปดูกระดานก่อน
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
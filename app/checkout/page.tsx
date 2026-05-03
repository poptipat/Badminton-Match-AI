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
        // 🌟 แก้ไขตรงนี้: เติม !profile_id เพื่อบอกให้ Supabase รู้ว่าดึงข้อมูลจากคนตี
        const { data: partData, error } = await supabase
          .from("session_participants")
          .select("*, profiles!profile_id(display_name)")
          .eq("session_id", session.id)
          .eq("profile_id", user.id)
          .single();

        if (error) {
          console.error("เกิดข้อผิดพลาด:", error);
        }
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

    // 1. อัปโหลดไฟล์ไปที่ Bucket 'slips'
    const { error: uploadError } = await supabase.storage.from('slips').upload(filePath, file);

    if (uploadError) {
      alert("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
      console.error(uploadError);
      setUploading(false);
      return;
    }

    // 2. ขอ URL ของรูปภาพ
    const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);

    // 3. อัปเดตสถานะการจ่ายเงิน
    await supabase
      .from("session_participants")
      .update({
        payment_status: "pending", // เปลี่ยนสถานะเป็น รอตรวจสอบ
        payment_slip_url: publicUrlData.publicUrl,
        checkout_time: new Date().toISOString()
      })
      .eq("id", participant.id);

    alert("✅ ส่งสลิปเรียบร้อย! ขอบคุณที่มาร่วมสนุกกันครับ");
    fetchCheckoutData();
    setUploading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">กำลังโหลดบิลของคุณ...</div>;

  if (!participant) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <p className="text-gray-500 mb-4">คุณยังไม่ได้ลงชื่อในก๊วนวันนี้ครับ</p>
      <Link href="/" className="text-blue-600 underline font-bold">กลับหน้าหลัก</Link>
    </div>
  );

  // คำนวณยอดรวมสุทธิ
  const totalAmount = participant.total_amount_due + (participant.accumulated_shuttle_fee || 0);
  // สร้าง QR Code พร้อมเพย์แบบระบุยอดเงินเป๊ะๆ
  const qrCodeUrl = `https://promptpay.io/${PROMPTPAY_NUMBER}/${totalAmount}`;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans flex items-center justify-center">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* หัวบิล */}
        <div className="bg-blue-600 p-6 text-center text-white">
          <h1 className="text-2xl font-bold mb-1">💸 สรุปค่าใช้จ่าย</h1>
          <p className="text-blue-100">คุณ {participant.profiles?.display_name}</p>
        </div>

        <div className="p-6">
          {/* รายละเอียดค่าใช้จ่าย */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
            <div className="flex justify-between mb-2 text-gray-600">
              <span>ค่าสนาม (เหมา)</span>
              <span>{participant.total_amount_due} บาท</span>
            </div>
            <div className="flex justify-between mb-2 text-gray-600">
              <span>ค่าลูกแบด ({participant.games_played_today} เกม)</span>
              <span>{participant.accumulated_shuttle_fee || 0} บาท</span>
            </div>
            <hr className="my-3 border-gray-200" />
            <div className="flex justify-between font-bold text-xl text-gray-800">
              <span>ยอดรวมทั้งสิ้น</span>
              <span className="text-blue-600">{totalAmount} บาท</span>
            </div>
          </div>

          {/* สถานะการชำระเงิน */}
          {participant.payment_status === 'pending' ? (
            <div className="text-center p-6 bg-yellow-50 rounded-xl border border-yellow-200">
              <span className="text-4xl block mb-2">⏳</span>
              <h2 className="text-yellow-700 font-bold text-lg">ส่งสลิปแล้ว รอแอดมินตรวจสอบ</h2>
              <p className="text-yellow-600 text-sm mt-1">กลับบ้านพักผ่อนได้เลยครับ!</p>
              <Link href="/" className="mt-4 inline-block text-blue-600 font-semibold underline">กลับหน้าหลัก</Link>
            </div>
          ) : participant.payment_status === 'paid' ? (
            <div className="text-center p-6 bg-green-50 rounded-xl border border-green-200">
              <span className="text-4xl block mb-2">✅</span>
              <h2 className="text-green-700 font-bold text-lg">ชำระเงินเสร็จสมบูรณ์</h2>
              <Link href="/" className="mt-4 inline-block text-blue-600 font-semibold underline">กลับหน้าหลัก</Link>
            </div>
          ) : (
            // โซนจ่ายเงิน (สแกน QR + อัปสลิป)
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-500 mb-2">สแกน QR Code เพื่อโอนเงิน</p>
              <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 mx-auto mb-4 border p-2 rounded-xl shadow-sm" />
              
              <div className="mb-4 text-left">
                <label className="block text-sm font-bold text-gray-700 mb-2">แนบสลิปโอนเงิน</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <button 
                onClick={handleUploadSlip}
                disabled={uploading}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-md transition ${uploading ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
              >
                {uploading ? 'กำลังอัปโหลด...' : 'ยืนยันการชำระเงิน'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
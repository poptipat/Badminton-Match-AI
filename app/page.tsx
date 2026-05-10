"use client";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";

export default function Home() {
  // 🌟 เรียกใช้ "สมอง" บรรทัดเดียวจบ!
  const {
    user, sessionToday, loading, playerCount, allProfiles, 
    selectedPartner, setSelectedPartner, myRecord, isAdmin, 
    outstandingDebt, canJoinQueue, timeUntilQueueMsg,
    handleLogin, handleLogout, handleReserveSlot, 
    handleReadyToPlay, handleRest, handleCancelReservation
  } = useHomeDashboard();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold">กำลังโหลดข้อมูล...</div>;

  if (outstandingDebt) {
    const debtAmount = outstandingDebt.payment_status === 'court_paid' 
      ? (outstandingDebt.accumulated_shuttle_fee || 0) 
      : (outstandingDebt.total_amount_due + (outstandingDebt.accumulated_shuttle_fee || 0));
      
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
            {['pending', 'pending_final'].includes(outstandingDebt.payment_status) && (
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

  const isFull = sessionToday ? playerCount >= sessionToday.max_players : false;
  const todayDateFormatted = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (isoString: string) => isoString ? new Date(isoString).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : "";

  const isActiveInQueue = myRecord && ['waiting', 'preparing', 'playing'].includes(myRecord.queue_status);
  const hasReserved = myRecord !== null;
  const hasPlayed = (myRecord?.games_played_today || 0) > 0;

  // 🌟 ลอจิกสำคัญ: ตรวจสอบว่าต้องโชว์ปุ่ม "เช็คบิล" ไหม
  // โชว์ถ้า: ยังไม่จ่ายเลย(unpaid), รอตรวจ(pending/pending_final) หรือ จ่ายแค่ค่าสนามแต่ค้างค่าลูก(court_paid)
  const owesMoney = myRecord && myRecord.payment_status !== 'paid' && !(myRecord.payment_status === 'court_paid' && (myRecord.accumulated_shuttle_fee || 0) === 0);

  // 🌟 ลอจิก: ถ้าเป็นระบบโอนก่อน (pay_first) บังคับว่าต้องสถานะ court_paid หรือ paid ถึงจะลงคิวตีได้
  const isPayFirst = sessionToday?.reservation_type === 'pay_first';
  const hasPaidCourtFee = myRecord?.payment_status === 'court_paid' || myRecord?.payment_status === 'paid' || myRecord?.payment_status === 'pending_final';

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

                  {hasReserved && !isActiveInQueue && (
                    <div className="mb-4 text-left p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                      <label className="block text-sm font-semibold text-emerald-700 mb-2">อยากจับคู่กับใครไหม?</label>
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
                  
                  {!hasReserved ? (
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
                    <div className="space-y-3">
                      
                      {isActiveInQueue ? (
                        <button 
                          onClick={handleRest} 
                          className="bg-amber-50 text-amber-600 px-6 py-4 rounded-xl w-full font-bold hover:bg-amber-100 transition-all shadow-sm active:scale-95 border border-amber-200"
                        >
                          ⏸️ พักคิวชั่วคราว
                        </button>
                      ) : (
                        <div className="space-y-3">
                          
                          {/* 🌟 ปุ่มเขียว: บล็อกการลงคิวหากเปิด Pay First แล้วยังไม่จ่ายค่าสนาม */}
                          <button 
                            onClick={handleReadyToPlay} 
                            disabled={!canJoinQueue || (isPayFirst && !hasPaidCourtFee)}
                            className={`w-full px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md 
                              ${(!canJoinQueue || (isPayFirst && !hasPaidCourtFee)) 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed border-b-4 border-slate-300" 
                                : "bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 border-b-4 border-emerald-700"
                              }`}
                          >
                            {!canJoinQueue ? (
                              <span className="flex flex-col items-center gap-1">
                                <span>🔒 ยังไม่เปิดรับคิว</span>
                                <span className="text-xs font-medium text-slate-500">({timeUntilQueueMsg})</span>
                              </span>
                            ) : (isPayFirst && !hasPaidCourtFee) ? (
                              <span className="flex flex-col items-center gap-1">
                                <span className="text-rose-500">🔒 รอชำระค่าสนาม</span>
                                <span className="text-[11px] font-medium text-slate-500">(กดปุ่มเช็คบิลด้านล่าง เพื่อโอนเงินเข้าคิว)</span>
                              </span>
                            ) : (
                              "🏸 ถึงคอร์ดแล้ว! ลงคิวพร้อมตี"
                            )}
                          </button>
                          
                          {!hasPlayed && (
                            <button 
                              onClick={handleCancelReservation} 
                              className="text-slate-400 text-sm font-semibold underline hover:text-rose-500 transition-all mt-2 w-full"
                            >
                              ยกเลิกการจองโควต้าวันนี้
                            </button>
                          )}
                        </div>
                      )}

                      {/* 🌟 ปุ่มเช็คบิล */}
                      {owesMoney && (
                        <a 
                          href="/checkout" 
                          className="flex items-center justify-center bg-[#FFBA42] text-[#013C58] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#F5A201] hover:text-white transition-all shadow-sm mt-4 border border-[#F5A201]"
                        >
                          💸 เช็คบิล / ชำระเงิน
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
                <div className="py-4 space-y-4">
                  <p className="text-slate-500 font-medium">วันนี้แอดมินยังไม่เปิดก๊วนครับ 😴</p>
                  
                  {/* 🌟 ย้ายปุ่มแอดมินมาใส่ตรงนี้ด้วย! (ตอนก๊วนปิด แอดมินจะได้เห็น) */}
                  {isAdmin && (
                    <div className="border-t border-slate-200 pt-5 mt-5 space-y-3">
                      <a href="/admin/settings" className="flex items-center justify-center bg-[#013458] text-[#F5A201] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-[#00537A] transition-all shadow-sm active:scale-95 border border-[#FFBA42]/30">
                        👑 ไปหน้าตั้งค่า (เปิดก๊วน)
                      </a>
                      <a href="/admin" className="flex items-center justify-center bg-white text-[#013458] px-6 py-4 rounded-xl w-full font-bold text-lg hover:bg-slate-50 transition-all shadow-sm active:scale-95 border border-slate-300">
                        📊 เข้ากระดานแอดมิน
                      </a>
                    </div>
                  )}
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
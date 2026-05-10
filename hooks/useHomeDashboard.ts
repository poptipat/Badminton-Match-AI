import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";

export function useHomeDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sessionToday, setSessionToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [playerCount, setPlayerCount] = useState(0); 
  const [allProfiles, setAllProfiles] = useState<any[]>([]); 
  const [selectedPartner, setSelectedPartner] = useState<string>(""); 
  const [myRecord, setMyRecord] = useState<any>(null); 
  const [isAdmin, setIsAdmin] = useState(false); 
  const [outstandingDebt, setOutstandingDebt] = useState<any>(null);
  const [canJoinQueue, setCanJoinQueue] = useState(false);
  const [timeUntilQueueMsg, setTimeUntilQueueMsg] = useState("");

  // ก้อนที่ 1: ดึงข้อมูลครั้งแรกเมื่อเปิดเว็บ และตั้งเวลาเช็คคิว
  useEffect(() => {
    checkUserAndSession();
    const timer = setInterval(() => {
      // ใช้ state จาก function scope เพื่อให้ค่าอัปเดต
      setSessionToday((currentSession: any) => {
        if (currentSession) checkQueueTime(currentSession.start_time);
        return currentSession;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []); 

  // ก้อนที่ 2: ดักฟังการเปลี่ยนแปลงแบบ Realtime
  useEffect(() => {
    // ถ้ายังไม่มี Session เปิดอยู่ ไม่ต้องเปลือง Resource ไปดักฟัง
    if (!sessionToday || !sessionToday.id) return;

    const channel = supabase
      .channel('session_participants_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // จับทุกการกระทำ (Insert, Update, Delete)
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionToday.id}` // ฟังเฉพาะข้อมูลของก๊วนวันนี้เท่านั้น
        },
        () => {
          // ทันทีที่มีคนกดจอง/ยกเลิก ให้เบราว์เซอร์ของทุกคนดึงข้อมูล Dashboard ใหม่แบบเงียบๆ
          checkUserAndSession();
        }
      )
      .subscribe();

    // Cleanup function ถอดสายเมื่อผู้ใช้ปิดหน้าเว็บ ป้องกัน Memory Leak
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionToday?.id]); 

  const checkQueueTime = (startTimeIso: string | null) => {
    if (!startTimeIso) {
      setCanJoinQueue(true); 
      setTimeUntilQueueMsg("");
      return;
    }
    const now = new Date();
    const startTime = new Date(startTimeIso);
    const queueOpenTime = new Date(startTime.getTime() - 15 * 60000); 

    if (now >= queueOpenTime) {
      setCanJoinQueue(true);
      setTimeUntilQueueMsg("");
    } else {
      setCanJoinQueue(false);
      const diffMs = queueOpenTime.getTime() - now.getTime();
      const diffMins = Math.ceil(diffMs / 60000);
      if (diffMins > 60) {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setTimeUntilQueueMsg(`เปิดรับคิวในอีก ${hours} ชม. ${mins} นาที`);
      } else {
        setTimeUntilQueueMsg(`เปิดรับคิวในอีก ${diffMins} นาที`);
      }
    }
  };

  const checkUserAndSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: rawData, error } = await supabase.rpc('get_home_dashboard_data', { p_user_id: user.id });

    if (error || !rawData) {
      console.error("RPC Error:", error);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลจากเซิร์ฟเวอร์");
      setLoading(false);
      return;
    }

    const data = rawData as any;

    if (data.error === 'profile_not_found') {
      window.location.href = "/setup-profile";
      return;
    }

    setIsAdmin(data.profile?.is_admin || false);

    if (data.outstanding_debt) {
      const debt = data.outstanding_debt;
      const courtFee = Number(debt.total_amount_due) || 0;
      const shuttleFee = Number(debt.accumulated_shuttle_fee) || 0;
      let isRealDebt = false;
      if (debt.payment_status === 'court_paid') {
        isRealDebt = shuttleFee > 0;
      } else {
        isRealDebt = (courtFee + shuttleFee) > 0;
      }

      if (isRealDebt) {
        setOutstandingDebt(debt);
        setLoading(false);
        return;
      }
    }

    if (data.session_today) {
      setSessionToday(data.session_today);
      checkQueueTime(data.session_today.start_time);
      setPlayerCount(data.player_count || 0);
      setAllProfiles(data.all_profiles || []);
      setMyRecord(data.my_record || null);
    } else {
      setSessionToday(null);
      setPlayerCount(0);
      setAllProfiles([]);
      setMyRecord(null);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "custom:line" as any,
      options: { redirectTo: `${window.location.origin}/` }
    });
    if (error) console.error("Login error:", error);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSessionToday(null);
    setIsAdmin(false);
    setMyRecord(null);
    setOutstandingDebt(null); 
  };

  const handleReserveSlot = async () => {
    if (!sessionToday || !user) return;
    const { data: rawData, error } = await supabase.rpc('reserve_slot', {
      p_session_id: sessionToday.id,
      p_profile_id: user.id,
      p_fee: sessionToday.court_fee_flat,
      preferred_partner_id: null,
      payment_status: "unpaid",
      queue_status: "resting", 
      total_amount_due: sessionToday.court_fee_flat 
    } as any);

    if (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลครับ");
      return;
    }

    const data = rawData as any;
    if (data && data.success === false) {
      alert(data.message); 
      checkUserAndSession(); 
      return;
    }

    if (data && data.success === true) {
      if (data.reservation_type === 'pay_first') {
        alert("✅ จองโควต้าสำเร็จ! ระบบจะพาไปหน้าชำระเงินเพื่อยืนยันสิทธิ์ลงคิวนะครับ");
        window.location.href = "/checkout"; 
      } else {
        alert("✅ จองโควต้าสำเร็จ! เมื่อเดินทางมาถึงคอร์ดแล้ว อย่าลืมมากดปุ่ม 'ลงคิวรอตี' นะครับ 🏸");
        checkUserAndSession(); 
      }
    }
  };

  const handleReadyToPlay = async () => {
    if (!myRecord) return;
    const { error } = await supabase.from("session_participants").update({ 
        queue_status: 'waiting', 
        preferred_partner_id: selectedPartner || null 
    }).eq("id", myRecord.id);

    if (!error) {
      alert("🔥 ลงคิวเรียบร้อย! เตรียมตัววอร์มร่างกายได้เลยครับ");
      checkUserAndSession(); 
    }
  };

  const handleRest = async () => {
    if (!myRecord) return;
    await supabase.from("session_participants").update({ queue_status: 'resting', preferred_partner_id: null }).eq("id", myRecord.id);
    checkUserAndSession();
  };

  const handleCancelReservation = async () => {
    if (!sessionToday || !myRecord) return;
    const now = new Date();
    const sessionStart = sessionToday.start_time ? new Date(sessionToday.start_time) : null;
    let diffHours = 999; 
    if (sessionStart) {
      diffHours = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    if (diffHours >= 1 || !sessionStart) {
      if (!confirm("คุณกดยกเลิกก่อนเวลา 1 ชั่วโมง ระบบจะคืนโควต้าให้โดยไม่คิดค่าสนาม ยืนยันการยกเลิกหรือไม่?")) return;
      await supabase.from("session_participants").delete().eq("id", myRecord.id);
      alert("ยกเลิกการจองเรียบร้อยแล้ว หวังว่าจะมาเล่นด้วยกันรอบหน้านะครับ!");
      setMyRecord(null);
    } else {
      alert("⚠️ ไม่สามารถยกเลิกฟรีได้แล้วครับ (กระชั้นชิดเกินไป)\nระบบจะบันทึกค่าสนาม 50 บาทตามกติกา แต่หากคุณเปลี่ยนใจมาที่คอร์ด คุณยังสามารถกดลงคิวเพื่อเข้าเล่นได้ตามปกติครับ");
    }
    checkUserAndSession(); 
  };

  return {
    user, sessionToday, loading, playerCount, allProfiles, 
    selectedPartner, setSelectedPartner, myRecord, isAdmin, 
    outstandingDebt, canJoinQueue, timeUntilQueueMsg,
    handleLogin, handleLogout, handleReserveSlot, 
    handleReadyToPlay, handleRest, handleCancelReservation
  };
}
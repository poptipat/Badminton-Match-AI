"use client";
import { supabase } from "@/utils/supabase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  // States สำหรับ 5 คำถาม
  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
  const [q4, setQ4] = useState<number | null>(null);
  const [q5, setQ5] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // โทนสีของแบรนด์ (อ้างอิงเพื่อความเข้าใจ)
  // Light Blue: #A8E8F9, Med Blue: #00537A, Dark Blue: #013C58
  // Orange: #F5A201, Yellow-Orange: #FFBA42, Light Yellow: #FFD35B

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนทำการประเมินฝีมือครับ");
      router.push("/");
      return;
    }

    // เช็กว่าเคยทำแบบประเมินไปแล้วหรือยัง
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      // ถ้ามีโปรไฟล์แล้ว ให้เด้งไปหน้าคิวเลย (ป้องกันการทำซ้ำ)
      router.push("/queue");
    } else {
      // ถ้ายังไม่มี ให้ดึงชื่อและรูปจาก LINE มาตั้งเป็นค่าเริ่มต้น
      setUser(user);
      setDisplayName(user.user_metadata?.name || "");
      setAvatarUrl(user.user_metadata?.picture || user.user_metadata?.avatar_url || "");
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) return alert("กรุณากรอกชื่อของคุณด้วยครับ!");
    if (q1 === null || q2 === null || q3 === null || q4 === null || q5 === null) {
      return alert("กรุณาตอบคำถามให้ครบทั้ง 5 ข้อ เพื่อความแม่นยำในการประเมินครับ!");
    }

    setLoading(true);

    // 🧮 ลอจิกคำนวณคะแนน ELO แบบใหม่ (คะแนนเต็ม 10)
    const totalScore = q1 + q2 + q3 + q4 + q5;
    let startingElo = 900; 
    let tierName = "BG (Beginner)";

    if (totalScore <= 2) {
      startingElo = Math.floor(Math.random() * (1000 - 900 + 1)) + 900; // 900-1000
      tierName = "BG (มือใหม่หัดตี)";
    } else if (totalScore <= 5) {
      startingElo = Math.floor(Math.random() * (1200 - 1000 + 1)) + 1000; // 1000-1200
      tierName = "N (มือระดับทั่วไป)";
    } else if (totalScore <= 8) {
      startingElo = Math.floor(Math.random() * (1400 - 1200 + 1)) + 1200; // 1200-1400
      tierName = "S (มือมาตรฐาน/เดินสาย)";
    } else {
      startingElo = Math.floor(Math.random() * (1600 - 1400 + 1)) + 1400; // 1400-1600
      tierName = "P (ระดับโปร/นักกีฬา)";
    }

    // 💾 บันทึกข้อมูลลงฐานข้อมูล profiles (ใช้ user.id จาก LINE เลย)
    const finalAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=F5A201&color=013C58`;

    const { error } = await supabase.from("profiles").insert([
      { 
        id: user.id, // บังคับใช้ ID ของระบบ Login
        display_name: displayName, 
        elo_rating: startingElo,
        avatar_url: finalAvatar
      }
    ]);

    if (error) {
      console.error("Error creating profile:", error);
      alert("เกิดข้อผิดพลาดในการสร้างโปรไฟล์ กรุณาลองใหม่ครับ");
      setLoading(false);
      return;
    }

    alert(`🎉 ยินดีต้อนรับคุณ ${displayName}!\nระบบประเมินฝีมือคุณอยู่ที่ระดับ: ${tierName}\nไปลุยกันเลย!`);
    router.push("/queue"); 
  };

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-[#013C58] text-[#A8E8F9] font-bold text-xl">กำลังตรวจสอบข้อมูล...</div>;
  }

  // Component สำหรับสร้างตัวเลือกแต่ละข้อ เพื่อความสะอาดของโค้ด
  const RadioOption = ({ name, value, stateValue, setState, label }: { name: string, value: number, stateValue: number | null, setState: any, label: string }) => {
    const isSelected = stateValue === value;
    return (
      <label 
        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 active:scale-[0.98] ${
          isSelected 
          ? 'bg-[#00537A] border-[#FFBA42] shadow-[0_0_15px_rgba(255,186,66,0.3)]' 
          : 'bg-[#013C58] border-[#00537A] hover:border-[#A8E8F9]'
        }`}
      >
        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-[#FFBA42]' : 'border-[#A8E8F9]'}`}>
          {isSelected && <div className="w-2.5 h-2.5 bg-[#FFBA42] rounded-full"></div>}
        </div>
        <span className={`text-sm md:text-base leading-relaxed ${isSelected ? 'text-[#FFD35B] font-bold' : 'text-[#A8E8F9]'}`}>
          {label}
        </span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-[#013C58] text-white p-4 md:p-6 font-sans">
      <div className="max-w-3xl mx-auto bg-[#00537A]/30 backdrop-blur-md rounded-3xl shadow-2xl border border-[#00537A] p-6 md:p-8 mt-4 md:mt-8 mb-10">
        
        {/* หัวข้อและคำอธิบาย */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#FFBA42] mb-3 drop-shadow-md">
            🏸 ประเมินระดับฝีมือ
          </h1>
          
          <div className="bg-[#013C58] border-l-4 border-[#F5A201] p-4 rounded-r-xl shadow-md text-left inline-block w-full max-w-2xl">
            <p className="text-[#A8E8F9] text-sm md:text-base leading-relaxed">
              <span className="text-[#FFD35B] font-bold text-lg mr-1">💡 โปรดตอบตามความเป็นจริง:</span><br/>
              การประเมินนี้ <strong className="text-white">ทำได้เพียงครั้งเดียวตอนสมัครสมาชิก</strong> ระบบ AI จะนำคำตอบไปคำนวณระดับฝีมือ (ELO) ของคุณ <u>เพื่อให้คุณได้ตีแบดกับเพื่อนในระดับที่สูสีกัน เล่นสนุก และไม่ห่างชั้นจนเกินไปครับ!</u>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* ข้อ 0: ชื่อ */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A] shadow-inner">
            <label className="block text-lg font-bold text-[#FFD35B] mb-2">ชื่อที่ใช้ในก๊วน (แสดงบนกระดาน)</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#00537A] text-white border border-[#A8E8F9]/30 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#F5A201] font-medium text-lg transition"
            />
          </div>

          {/* คำถามข้อ 1 */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A]">
            <label className="block text-lg md:text-xl font-bold text-white mb-4">1. ประสบการณ์และการตีลูกพื้นฐาน 🏸</label>
            <div className="space-y-3">
              <RadioOption name="q1" value={0} stateValue={q1} setState={setQ1} label="เพิ่งเริ่มหัดเล่น กะจังหวะลูกยังไม่ค่อยถูก ตีแป๊กบ่อย" />
              <RadioOption name="q1" value={1} stateValue={q1} setState={setQ1} label="เล่นมาพักนึง ตีโต้ได้สบาย แต่จังหวะบุกหรือรับลูกพุ่งๆ ยังมีพลาด" />
              <RadioOption name="q1" value={2} stateValue={q1} setState={setQ1} label="เล่นประจำ ทักษะแน่น ตีลูกได้แม่นยำ น้ำหนักลูกแน่นอน" />
            </div>
          </div>

          {/* คำถามข้อ 2 */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A]">
            <label className="block text-lg md:text-xl font-bold text-white mb-4">2. การเสิร์ฟและการรับลูกเสิร์ฟ 🎯</label>
            <div className="space-y-3">
              <RadioOption name="q2" value={0} stateValue={q2} setState={setQ2} label="เสิร์ฟยังติดเน็ตหรือโด่งไป รับลูกเสิร์ฟสั้น-ยาวยังไม่ค่อยชัวร์" />
              <RadioOption name="q2" value={1} stateValue={q2} setState={setQ2} label="เสิร์ฟสั้น-ยาวได้ตามสั่ง รับลูกเสิร์ฟหยอดหน้าเน็ตได้ดี" />
              <RadioOption name="q2" value={2} stateValue={q2} setState={setQ2} label="รับลูกตบได้ดี สวนกลับลูกเสิร์ฟให้ฝ่ายตรงข้ามเสียเปรียบได้แม่นยำ" />
            </div>
          </div>

          {/* คำถามข้อ 3 */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A]">
            <label className="block text-lg md:text-xl font-bold text-white mb-4">3. การเคลียร์ลูก (ตีเซฟไปหลังคอร์ด) 💪</label>
            <div className="space-y-3">
              <RadioOption name="q3" value={0} stateValue={q3} setState={setQ3} label="ตีเซฟยังไม่ค่อยถึงหลังคอร์ด หรือต้องใช้แรงเยอะมาก" />
              <RadioOption name="q3" value={1} stateValue={q3} setState={setQ3} label="โฟร์แฮนด์ตีถึงหลังได้สบาย แต่แบ็คแฮนด์ยังตีไม่ค่อยออก" />
              <RadioOption name="q3" value={2} stateValue={q3} setState={setQ3} label="ตีเซฟถึงหลังได้สบายๆ ทั้งโฟร์แฮนด์และแบ็คแฮนด์ พลิกแพลงลูกได้" />
            </div>
          </div>

          {/* คำถามข้อ 4 */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A]">
            <label className="block text-lg md:text-xl font-bold text-white mb-4">4. การเคลื่อนที่และความฟิต (Footwork) 👟</label>
            <div className="space-y-3">
              <RadioOption name="q4" value={0} stateValue={q4} setState={setQ4} label="วิ่งตามลูกไม่ค่อยทัน ก้าวเท้าสลับกันบ่อย กลับจุดศูนย์กลางช้า" />
              <RadioOption name="q4" value={1} stateValue={q4} setState={setQ4} label="วิ่งรอบคอร์ดได้ดี ถอยไปตีลูกโด่งได้ทัน แต่ถ้าโดนหลอกมีหลงทาง" />
              <RadioOption name="q4" value={2} stateValue={q4} setState={setQ4} label="สปริงข้อเท้าดี เคลื่อนที่เร็วมาก สามารถกระโดดตบ (Jump Smash) ได้ต่อเนื่อง" />
            </div>
          </div>

          {/* คำถามข้อ 5 */}
          <div className="bg-[#013C58] p-5 md:p-6 rounded-2xl border border-[#00537A]">
            <label className="block text-lg md:text-xl font-bold text-white mb-4">5. การคุมโซนและแทคติก (เวลาเล่นประเภทคู่) 🤝</label>
            <div className="space-y-3">
              <RadioOption name="q5" value={0} stateValue={q5} setState={setQ5} label="ยังงงตำแหน่ง ยืนทับเส้นหรือเผลอวิ่งแย่งลูกกับพาร์ทเนอร์บ่อยๆ" />
              <RadioOption name="q5" value={1} stateValue={q5} setState={setQ5} label="ยืนคู่ได้ปกติ รู้จังหวะหมุนสลับหน้า-หลังเวลาฝ่ายเราบุกหรือตั้งรับ" />
              <RadioOption name="q5" value={2} stateValue={q5} setState={setQ5} label="อ่านเกมขาด คุมพื้นที่ชดเชยให้พาร์ทเนอร์ได้ ดักลูกหน้าเน็ตเก่งมาก" />
            </div>
          </div>

          {/* ปุ่ม Submit */}
          <div className="pt-6 border-t border-[#00537A]">
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-4 md:py-5 rounded-2xl font-extrabold text-lg md:text-xl shadow-[0_4px_20px_rgba(245,162,1,0.4)] transition-all active:scale-[0.98] ${
                loading 
                ? 'bg-[#00537A] text-[#A8E8F9] cursor-wait' 
                : 'bg-[#F5A201] hover:bg-[#FFBA42] text-[#013C58]'
              }`}
            >
              {loading ? 'กำลังประมวลผล ELO ของคุณ...' : '🔥 บันทึกโปรไฟล์ & เริ่มลุยกันเลย!'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
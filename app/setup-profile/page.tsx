"use client";
import { supabase } from "@/utils/supabase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  // States สำหรับ 5 คำถาม (ลอจิกเดิม 100%)
  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
  const [q4, setQ4] = useState<number | null>(null);
  const [q5, setQ5] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

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

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (existingProfile) {
      router.push("/queue");
    } else {
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

    const totalScore = q1 + q2 + q3 + q4 + q5;
    let startingElo = 900; 
    let tierName = "BG (Beginner)";

    if (totalScore <= 2) {
      startingElo = Math.floor(Math.random() * (1000 - 900 + 1)) + 900;
      tierName = "BG (มือใหม่หัดตี)";
    } else if (totalScore <= 5) {
      startingElo = Math.floor(Math.random() * (1200 - 1000 + 1)) + 1000;
      tierName = "N (มือระดับทั่วไป)";
    } else if (totalScore <= 8) {
      startingElo = Math.floor(Math.random() * (1400 - 1200 + 1)) + 1200;
      tierName = "S (มือมาตรฐาน/เดินสาย)";
    } else {
      startingElo = Math.floor(Math.random() * (1600 - 1400 + 1)) + 1400;
      tierName = "P (ระดับโปร/นักกีฬา)";
    }

    const finalAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=F5A201&color=013C58`;

    const { error } = await supabase.from("profiles").insert([
      { 
        id: user.id, 
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-[#013C58] font-bold text-xl">กำลังตรวจสอบข้อมูล...</div>;
  }

  // 🌟 อัปเกรด RadioOption ให้มี 3D Effect และ Animation เด้งดึ๋ง
  const RadioOption = ({ name, value, stateValue, setState, label }: { name: string, value: number, stateValue: number | null, setState: any, label: string }) => {
    const isSelected = stateValue === value;
    return (
      <label 
        onClick={() => setState(value)}
        className={`group relative flex items-start gap-4 p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 ease-out ${
          isSelected 
          ? 'bg-gradient-to-br from-[#FFFBF0] to-white border-[#F5A201] shadow-[0_8px_20px_rgba(245,162,1,0.2)] scale-[1.02] -translate-y-1 ring-2 ring-[#F5A201]/20' 
          : 'bg-white border-slate-200 shadow-sm hover:border-[#F5A201]/40 hover:shadow-md hover:-translate-y-1'
        }`}
      >
        {/* วงกลมติ๊กเลือกแบบ 3D */}
        <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          isSelected 
          ? 'border-[#F5A201] bg-[#F5A201] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]' 
          : 'border-slate-300 bg-slate-50 group-hover:border-[#F5A201]/50'
        }`}>
          {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce"></div>}
        </div>
        
        {/* ข้อความ */}
        <span className={`text-sm md:text-base leading-relaxed transition-colors duration-300 ${
          isSelected ? 'text-[#013C58] font-bold' : 'text-slate-600 font-medium group-hover:text-slate-800'
        }`}>
          {label}
        </span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 font-sans relative overflow-hidden">
      
      {/* Background Blobs ตกแต่งให้ดู Modern */}
      <div className="absolute top-[-5%] left-[-10%] w-72 h-72 bg-[#A8E8F9] rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
      <div className="absolute top-[20%] right-[-5%] w-80 h-80 bg-[#FFBA42] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-10 mt-4 md:mt-8 mb-10 relative z-10">
        
        {/* หัวข้อและคำอธิบาย */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#013C58] mb-4 tracking-tight">
            🏸 ประเมินระดับฝีมือ
          </h1>
          
          <div className="bg-[#FFFBF0] border-l-4 border-[#F5A201] p-4 rounded-r-xl shadow-sm text-left inline-block w-full max-w-2xl">
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              <span className="text-[#F5A201] font-bold text-lg mr-1">💡 โปรดตอบตามความเป็นจริง:</span><br/>
              การประเมินนี้ <strong className="text-[#013C58]">ทำได้เพียงครั้งเดียวตอนสมัครสมาชิก</strong> ระบบ AI จะนำคำตอบไปคำนวณระดับฝีมือ (ELO) ของคุณ <u>เพื่อให้คุณได้ตีแบดกับเพื่อนในระดับที่สูสีกัน เล่นสนุก และไม่ห่างชั้นจนเกินไปครับ!</u>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* ข้อ 0: ชื่อ */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#013C58]"></div>
            <label className="block text-lg font-bold text-[#013C58] mb-3 pl-2">ชื่อที่ใช้ในก๊วน (แสดงบนกระดาน)</label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="กรอกชื่อของคุณ..."
              className="w-full bg-white text-slate-800 border border-slate-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-[#F5A201] font-bold text-lg transition shadow-inner"
            />
          </div>

          {/* คำถามข้อ 1 */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A8E8F9]"></div>
            <label className="block text-lg md:text-xl font-bold text-[#013C58] mb-5 pl-2">1. ประสบการณ์และการตีลูกพื้นฐาน 🏸</label>
            <div className="space-y-4">
              <RadioOption name="q1" value={0} stateValue={q1} setState={setQ1} label="เพิ่งเริ่มหัดเล่น กะจังหวะลูกยังไม่ค่อยถูก ตีแป๊กบ่อย" />
              <RadioOption name="q1" value={1} stateValue={q1} setState={setQ1} label="เล่นมาพักนึง ตีโต้ได้สบาย แต่จังหวะบุกหรือรับลูกพุ่งๆ ยังมีพลาด" />
              <RadioOption name="q1" value={2} stateValue={q1} setState={setQ1} label="เล่นประจำ ทักษะแน่น ตีลูกได้แม่นยำ น้ำหนักลูกแน่นอน" />
            </div>
          </div>

          {/* คำถามข้อ 2 */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A8E8F9]"></div>
            <label className="block text-lg md:text-xl font-bold text-[#013C58] mb-5 pl-2">2. การเสิร์ฟและการรับลูกเสิร์ฟ 🎯</label>
            <div className="space-y-4">
              <RadioOption name="q2" value={0} stateValue={q2} setState={setQ2} label="เสิร์ฟยังติดเน็ตหรือโด่งไป รับลูกเสิร์ฟสั้น-ยาวยังไม่ค่อยชัวร์" />
              <RadioOption name="q2" value={1} stateValue={q2} setState={setQ2} label="เสิร์ฟสั้น-ยาวได้ตามสั่ง รับลูกเสิร์ฟหยอดหน้าเน็ตได้ดี" />
              <RadioOption name="q2" value={2} stateValue={q2} setState={setQ2} label="รับลูกตบได้ดี สวนกลับลูกเสิร์ฟให้ฝ่ายตรงข้ามเสียเปรียบได้แม่นยำ" />
            </div>
          </div>

          {/* คำถามข้อ 3 */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A8E8F9]"></div>
            <label className="block text-lg md:text-xl font-bold text-[#013C58] mb-5 pl-2">3. การเคลียร์ลูก (ตีเซฟไปหลังคอร์ด) 💪</label>
            <div className="space-y-4">
              <RadioOption name="q3" value={0} stateValue={q3} setState={setQ3} label="ตีเซฟยังไม่ค่อยถึงหลังคอร์ด หรือต้องใช้แรงเยอะมาก" />
              <RadioOption name="q3" value={1} stateValue={q3} setState={setQ3} label="โฟร์แฮนด์ตีถึงหลังได้สบาย แต่แบ็คแฮนด์ยังตีไม่ค่อยออก" />
              <RadioOption name="q3" value={2} stateValue={q3} setState={setQ3} label="ตีเซฟถึงหลังได้สบายๆ ทั้งโฟร์แฮนด์และแบ็คแฮนด์ พลิกแพลงลูกได้" />
            </div>
          </div>

          {/* คำถามข้อ 4 */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A8E8F9]"></div>
            <label className="block text-lg md:text-xl font-bold text-[#013C58] mb-5 pl-2">4. การเคลื่อนที่และความฟิต (Footwork) 👟</label>
            <div className="space-y-4">
              <RadioOption name="q4" value={0} stateValue={q4} setState={setQ4} label="วิ่งตามลูกไม่ค่อยทัน ก้าวเท้าสลับกันบ่อย กลับจุดศูนย์กลางช้า" />
              <RadioOption name="q4" value={1} stateValue={q4} setState={setQ4} label="วิ่งรอบคอร์ดได้ดี ถอยไปตีลูกโด่งได้ทัน แต่ถ้าโดนหลอกมีหลงทาง" />
              <RadioOption name="q4" value={2} stateValue={q4} setState={setQ4} label="สปริงข้อเท้าดี เคลื่อนที่เร็วมาก สามารถกระโดดตบ (Jump Smash) ได้ต่อเนื่อง" />
            </div>
          </div>

          {/* คำถามข้อ 5 */}
          <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#A8E8F9]"></div>
            <label className="block text-lg md:text-xl font-bold text-[#013C58] mb-5 pl-2">5. การคุมโซนและแทคติก (เวลาเล่นประเภทคู่) 🤝</label>
            <div className="space-y-4">
              <RadioOption name="q5" value={0} stateValue={q5} setState={setQ5} label="ยังงงตำแหน่ง ยืนทับเส้นหรือเผลอวิ่งแย่งลูกกับพาร์ทเนอร์บ่อยๆ" />
              <RadioOption name="q5" value={1} stateValue={q5} setState={setQ5} label="ยืนคู่ได้ปกติ รู้จังหวะหมุนสลับหน้า-หลังเวลาฝ่ายเราบุกหรือตั้งรับ" />
              <RadioOption name="q5" value={2} stateValue={q5} setState={setQ5} label="อ่านเกมขาด คุมพื้นที่ชดเชยให้พาร์ทเนอร์ได้ ดักลูกหน้าเน็ตเก่งมาก" />
            </div>
          </div>

          {/* 🌟 ปุ่ม Submit แบบมีมิติ (Physical Button Effect) */}
          <div className="pt-8">
            <button 
              type="submit" 
              disabled={loading}
              className={`relative w-full py-5 rounded-2xl font-black text-xl transition-all duration-200 outline-none ${
                loading 
                ? 'bg-slate-300 text-slate-500 cursor-wait shadow-none translate-y-[4px]' 
                : 'bg-[#F5A201] text-white hover:bg-[#FFBA42] shadow-[0_6px_0_0_#D97706] hover:shadow-[0_4px_0_0_#D97706] hover:translate-y-[2px] active:shadow-none active:translate-y-[6px]'
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
"use client";
import { supabase } from "@/utils/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SetupProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) return alert("กรุณากรอกชื่อของคุณด้วยครับ!");
    if (q1 === null || q2 === null || q3 === null) return alert("กรุณาตอบคำถามให้ครบทั้ง 3 ข้อเพื่อประเมินฝีมือครับ!");

    setLoading(true);

    // 🧮 ลอจิกแปลงคำตอบเป็นคะแนน ELO เริ่มต้น
    const totalScore = q1 + q2 + q3;
    let startingElo = 900; // ค่าเริ่มต้น (Beginner)
    let tierName = "BG (Beginner)";

    if (totalScore <= 2) {
      startingElo = Math.floor(Math.random() * (1000 - 900 + 1)) + 900; // สุ่ม 900-1000
      tierName = "BG (Beginner)";
    } else if (totalScore <= 4) {
      startingElo = Math.floor(Math.random() * (1200 - 1000 + 1)) + 1000; // สุ่ม 1000-1200
      tierName = "N (Novice)";
    } else if (totalScore === 5) {
      startingElo = Math.floor(Math.random() * (1400 - 1200 + 1)) + 1200; // สุ่ม 1200-1400
      tierName = "S (Standard)";
    } else if (totalScore === 6) {
      startingElo = Math.floor(Math.random() * (1500 - 1400 + 1)) + 1400; // สุ่ม 1400-1500
      tierName = "P (Pro)";
    }

    // 💾 บันทึกข้อมูลลงฐานข้อมูล profiles
    const { error } = await supabase.from("profiles").insert([
      { 
        display_name: displayName, 
        elo_rating: startingElo,
        avatar_url: `https://ui-avatars.com/api/?name=${displayName}&background=random&color=fff`
      }
    ]);

    if (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการสร้างโปรไฟล์ กรุณาลองใหม่");
      setLoading(false);
      return;
    }

    alert(`🎉 ยินดีต้อนรับคุณ ${displayName}!\nระบบประเมินฝีมือคุณอยู่ที่ระดับ: ${tierName} (ELO: ${startingElo})`);
    router.push("/queue"); // ส่งกลับไปหน้ากระดานคิว
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans flex items-center justify-center">
      <div className="max-w-2xl w-full bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 p-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-2">
            🏸 สร้างโปรไฟล์นักแบดมินตัน
          </h1>
          <p className="text-gray-400">ตอบคำถาม 3 ข้อเพื่อช่วยให้ AI จัดมือที่สูสีที่สุดให้กับคุณ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* ส่วนกรอกชื่อ */}
          <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
            <label className="block text-lg font-bold text-yellow-400 mb-2">1. ชื่อที่ใช้ในก๊วน (Display Name)</label>
            <input 
              type="text" 
              placeholder="เช่น Pop Patipat, Boy..." 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {/* คำถามข้อ 1 */}
          <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
            <label className="block text-lg font-bold text-blue-400 mb-3">2. ทักษะการเสิร์ฟและการรับลูกของคุณเป็นอย่างไร?</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-blue-500 transition">
                <input type="radio" name="q1" value={0} onChange={() => setQ1(0)} className="w-5 h-5 accent-blue-500" />
                <span className="text-gray-300">เพิ่งหัดเสิร์ฟ / รับลูกเสิร์ฟยังไม่ค่อยแม่น มีเสียบ้าง</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-blue-500 transition">
                <input type="radio" name="q1" value={1} onChange={() => setQ1(1)} className="w-5 h-5 accent-blue-500" />
                <span className="text-gray-300">เสิร์ฟสั้น-ยาวได้ / รับลูกหยอดหน้าเน็ตได้ดี</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-blue-500 transition">
                <input type="radio" name="q1" value={2} onChange={() => setQ1(2)} className="w-5 h-5 accent-blue-500" />
                <span className="text-gray-300">รับลูกตบได้ดี / ดึงจังหวะและวางลูกสวนกลับได้แม่นยำ</span>
              </label>
            </div>
          </div>

          {/* คำถามข้อ 2 */}
          <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
            <label className="block text-lg font-bold text-green-400 mb-3">3. การเคลื่อนที่และความฟิต (Footwork)</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-green-500 transition">
                <input type="radio" name="q2" value={0} onChange={() => setQ2(0)} className="w-5 h-5 accent-green-500" />
                <span className="text-gray-300">วิ่งรับลูกไม่ค่อยทัน / ยังก้าวเท้าไม่ค่อยถูก</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-green-500 transition">
                <input type="radio" name="q2" value={1} onChange={() => setQ2(1)} className="w-5 h-5 accent-green-500" />
                <span className="text-gray-300">วิ่งรอบคอร์ดได้ / ถอยไปตีลูกโด่งท้ายคอร์ดได้สบาย</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-green-500 transition">
                <input type="radio" name="q2" value={2} onChange={() => setQ2(2)} className="w-5 h-5 accent-green-500" />
                <span className="text-gray-300">เคลื่อนที่เร็ว / กระโดดสแมช (Jump Smash) ได้ต่อเนื่อง</span>
              </label>
            </div>
          </div>

          {/* คำถามข้อ 3 */}
          <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
            <label className="block text-lg font-bold text-red-400 mb-3">4. การคุมโซน (เวลาเล่นประเภทคู่)</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-red-500 transition">
                <input type="radio" name="q3" value={0} onChange={() => setQ3(0)} className="w-5 h-5 accent-red-500" />
                <span className="text-gray-300">ยังสับสนการยืน / วิ่งชนหรือแย่งลูกกับพาร์ทเนอร์บ่อยๆ</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-red-500 transition">
                <input type="radio" name="q3" value={1} onChange={() => setQ3(1)} className="w-5 h-5 accent-red-500" />
                <span className="text-gray-300">ยืนคู่ได้ปกติ / รู้จังหวะหมุนเปลี่ยนหน้า-หลังเวลาตบ</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-gray-900 rounded-xl border border-gray-700 cursor-pointer hover:border-red-500 transition">
                <input type="radio" name="q3" value={2} onChange={() => setQ3(2)} className="w-5 h-5 accent-red-500" />
                <span className="text-gray-300">คุมพื้นที่แทนพาร์ทเนอร์ที่เสียจังหวะได้ / ดักลูกหน้าเน็ตเก่ง</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Link href="/queue" className="w-1/3 py-4 text-center rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition">
              ยกเลิก
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className={`w-2/3 py-4 rounded-xl font-bold text-white shadow-lg transition ${loading ? 'bg-gray-600' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500'}`}
            >
              {loading ? 'กำลังสร้างโปรไฟล์...' : 'บันทึกและประเมินฝีมือ'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
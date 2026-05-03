import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ใส่ 2 บรรทัดนี้เพิ่มเข้าไปเพื่อดักดูค่า
console.log("👉 URL ที่แอปเห็น:", supabaseUrl)
console.log("👉 KEY ที่แอปเห็น:", supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

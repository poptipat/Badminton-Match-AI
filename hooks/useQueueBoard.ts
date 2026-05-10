import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";

export function useQueueBoard() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 1. ดึงข้อมูลครั้งแรกด้วย RPC (ประหยัดเวลาโหลดหน้าจอ)
  const fetchInitialData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // ยิง RPC ตัวเดียวจบ ไม่เกิดคอขวด
    const { data, error } = await supabase.rpc('get_queue_board_data', {
      p_user_id: user?.id || null
    });

    if (error) {
      console.error("RPC Error:", error);
      setLoading(false);
      return;
    }

    const result = data as any;
    setIsAdmin(result.is_admin);
    setSessionId(result.session_id);
    setParticipants(result.participants || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. ดักฟัง Realtime แบบฉลาด (สกัดกั้น DDoS)
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel('queue_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`
      }, async (payload) => {
        
        // 🌟 หัวใจสำคัญ: ถ้ามีการขยับคิว ให้อัปเดตแค่ State ไม่ต้องวิ่งไปกวน Database
        if (payload.eventType === 'UPDATE') {
          setParticipants(prev => prev.map(p => 
            p.id === payload.new.id 
              ? { ...p, queue_status: payload.new.queue_status, court_number: payload.new.court_number, games_played_today: payload.new.games_played_today } 
              : p
          ));
        } 
        // ถ้ามีคนมากดลงคิวใหม่ ค่อยไปดึงข้อมูลแค่ "คนเดียว" มาแปะเพิ่ม
        else if (payload.eventType === 'INSERT') {
          const { data: newPlayer } = await supabase
            .from('session_participants')
            .select(`id, session_id, profile_id, queue_status, games_played_today, join_time, court_number, profiles!profile_id ( display_name, avatar_url, elo_rating )`)
            .eq('id', payload.new.id)
            .single();
            
          if (newPlayer) {
            setParticipants(prev => [...prev, newPlayer]);
          }
        }
        // ถ้ามีคนกดยกเลิกคิว ก็ลบออกจาก State ทันที
        else if (payload.eventType === 'DELETE') {
           setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // 3. ใช้ useMemo ป้องกันไม่ให้มือถือ/ทีวี ต้องคำนวณคิวใหม่ซ้ำซ้อนทุกเสี้ยววินาที
  const waiting = useMemo(() => participants.filter(p => p.queue_status === 'waiting'), [participants]);
  
  const preparingByCourt = useMemo(() => {
    const prep = participants.filter(p => p.queue_status === 'preparing');
    return prep.reduce((acc, curr) => {
      const court = curr.court_number || 1; 
      if (!acc[court]) acc[court] = [];
      acc[court].push(curr);
      return acc;
    }, {} as Record<number, any[]>);
  }, [participants]);

  const playingByCourt = useMemo(() => {
    const play = participants.filter(p => p.queue_status === 'playing');
    return play.reduce((acc, curr) => {
      const court = curr.court_number || 1; 
      if (!acc[court]) acc[court] = [];
      acc[court].push(curr);
      return acc;
    }, {} as Record<number, any[]>);
  }, [participants]);

  return {
    loading,
    isAdmin,
    waiting,
    preparingByCourt,
    playingByCourt
  };
}
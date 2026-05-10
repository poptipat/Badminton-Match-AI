export interface Profile {
    id: string;
    display_name: string;
    is_admin: boolean;
  }
  
  export interface DailySession {
    id: string;
    start_time: string | null;
    end_time: string | null;
    court_fee_flat: number;
    base_shuttle_fee: number;
    max_players: number;
    reservation_type: string;
    is_active: boolean;
  }
  
  export interface ParticipantRecord {
    id: string;
    session_id: string;
    profile_id: string;
    payment_status: 'unpaid' | 'pending' | 'pending_final' | 'court_paid' | 'paid';
    queue_status: 'resting' | 'waiting' | 'preparing' | 'playing';
    accumulated_shuttle_fee: number;
    total_amount_due: number;
    games_played_today: number;
  }
  
  // พิมพ์เขียวสำหรับก้อนข้อมูลที่ตอบกลับมาจาก RPC
  export interface DashboardData {
    error?: string;
    profile: Profile | null;
    outstanding_debt: ParticipantRecord | null;
    session_today: DailySession | null;
    player_count: number;
    my_record: ParticipantRecord | null;
    all_profiles: { id: string; display_name: string }[];
  }
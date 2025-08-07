export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
}

export interface DirectMessage {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  is_private: boolean
  invite_code?: string
}

export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  joined_at: string
  role: 'admin' | 'member'
}

export interface Message {
  id: string
  content: string
  sender_id: string
  sender_name?: string
  sender_email?: string
  sender_username?: string
  created_at: string
  updated_at: string
  direct_message_id?: string
  room_id?: string
  sender?: User
}

export interface ChatSession {
  id: string
  type: 'dm' | 'room'
  name: string
  last_message?: Message
  unread_count: number
  participants?: User[]
  inviteCode?: string
} 
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'impactconnect-auth',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
})

// Test connection
if (typeof window !== 'undefined') {
  console.log('Supabase client created with URL:', supabaseUrl)
}

// Database types
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  created_at: string
  status?: 'online' | 'offline' | 'away' | 'busy'
  last_seen?: string
}

export interface Room {
  id: string
  name: string
  description?: string
  is_private: boolean
  created_by: string
  created_at: string
  updated_at: string
  invite_code?: string
  max_members?: number
  category?: string
}

export interface Message {
  id: string
  content: string
  room_id?: string
  sender_id: string
  recipient_id?: string
  created_at: string
  updated_at: string
  reactions?: Array<{
    emoji: string
    count: number
    users: string[]
  }>
  reply_to?: string
  edited_at?: string
}

export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  joined_at: string
  nickname?: string
}

export interface RoomInvite {
  id: string
  room_id: string
  code: string
  created_by: string
  created_at: string
  expires_at?: string
  max_uses?: number
  used_count: number
  is_active: boolean
}

export interface UserPresence {
  user_id: string
  status: 'online' | 'offline' | 'away' | 'busy'
  last_seen: string
  room_id?: string
}

// Real-time message subscription
export function subscribeToMessages(
  roomId: string | null,
  userId: string | null,
  onMessage: (message: Message) => void
) {
  if (!roomId && !userId) return null

  // Try to use real-time subscriptions first
  try {
    const channel = supabase
      .channel(`messages-${roomId || userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: roomId 
            ? `room_id=eq.${roomId}`
            : `or(and(sender_id.eq.${userId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${userId}))`
        },
        (payload: any) => {
          onMessage(payload.new as Message)
        }
      )
      .subscribe()

    return channel
  } catch (error) {
    console.warn('Real-time subscription failed, falling back to polling:', error)
    return null
  }
}

// Real-time room updates subscription
export function subscribeToRoomUpdates(
  roomId: string,
  onUpdate: (room: Room) => void
) {
  try {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload: any) => {
          onUpdate(payload.new as Room)
        }
      )
      .subscribe()

    return channel
  } catch (error) {
    console.warn('Room real-time subscription failed:', error)
    return null
  }
}

// Real-time member updates subscription
export function subscribeToMemberUpdates(
  roomId: string,
  onMemberJoin: (member: RoomMember) => void,
  onMemberLeave: (memberId: string) => void
) {
  try {
    const channel = supabase
      .channel(`members-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`
        },
        (payload: any) => {
          onMemberJoin(payload.new as RoomMember)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`
        },
        (payload: any) => {
          onMemberLeave(payload.old.id)
        }
      )
      .subscribe()

    return channel
  } catch (error) {
    console.warn('Member real-time subscription failed:', error)
    return null
  }
}

// Real-time user presence subscription
export function subscribeToUserPresence(
  onPresenceUpdate: (presence: UserPresence) => void
) {
  try {
    const channel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload: any) => {
          onPresenceUpdate(payload.new as UserPresence)
        }
      )
      .subscribe()

    return channel
  } catch (error) {
    console.warn('User presence real-time subscription failed:', error)
    return null
  }
}

// Polling fallback for real-time updates
export function startMessagePolling(
  roomId: string | null,
  userId: string | null,
  onMessage: (message: Message) => void,
  interval: number = 2000
) {
  let lastMessageId: string | null = null

  const poll = async () => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (roomId) {
        query = query.eq('room_id', roomId)
              } else if (userId) {
          query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${userId})`)
        }

      const { data } = await query
      
      if (data && data.length > 0) {
        const latestMessage = data[0]
        if (latestMessage.id !== lastMessageId) {
          onMessage(latestMessage)
          lastMessageId = latestMessage.id
        }
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }

  const intervalId = setInterval(poll, interval)
  
  return () => {
    clearInterval(intervalId)
  }
}

// Create message subscription with fallback
export function createMessageSubscription(
  roomId: string | null,
  userId: string | null,
  onMessage: (message: Message) => void
) {
  // Try real-time first
  const realtimeUnsubscribe = subscribeToMessages(roomId, userId, onMessage)
  
  if (realtimeUnsubscribe) {
    return realtimeUnsubscribe
  }
  
  // Fallback to polling
  return startMessagePolling(roomId, userId, onMessage)
} 
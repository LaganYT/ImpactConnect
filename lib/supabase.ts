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

// Enhanced Database types
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  created_at: string
  status?: 'online' | 'offline' | 'away' | 'busy' | 'invisible'
  last_seen?: string
  bio?: string
  username?: string
  display_name?: string
  is_verified?: boolean
  custom_status?: string
  timezone?: string
  language?: string
  theme?: 'light' | 'dark' | 'auto'
  notification_settings?: {
    message_notifications: 'all' | 'mentions' | 'none'
    sound_enabled: boolean
    desktop_notifications: boolean
    email_notifications: boolean
  }
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
  icon_url?: string
  banner_url?: string
  default_role?: 'admin' | 'moderator' | 'member'
  slowmode_seconds?: number
  is_nsfw?: boolean
  topic?: string
  member_count?: number
  last_message_at?: string
}

export interface Message {
  id: string
  content: string
  room_id?: string
  sender_id: string
  recipient_id?: string
  created_at: string
  updated_at: string
  edited_at?: string
  reply_to?: string
  is_pinned?: boolean
  is_system_message?: boolean
  attachments?: MessageAttachment[]
  reactions?: MessageReaction[]
  mentions?: string[]
  embeds?: MessageEmbed[]
  flags?: number
}

export interface MessageAttachment {
  id: string
  message_id: string
  file_name: string
  file_url: string
  file_size: number
  mime_type: string
  width?: number
  height?: number
  duration?: number
  created_at: string
}

export interface MessageReaction {
  id: string
  message_id: string
  emoji: string
  user_id: string
  created_at: string
}

export interface MessageEmbed {
  id: string
  message_id: string
  title?: string
  description?: string
  url?: string
  image_url?: string
  thumbnail_url?: string
  color?: string
  author?: {
    name: string
    url?: string
    icon_url?: string
  }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  footer?: {
    text: string
    icon_url?: string
  }
  timestamp?: string
}

export interface RoomMember {
  id: string
  room_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member' | 'guest'
  joined_at: string
  nickname?: string
  permissions?: string[]
  is_muted?: boolean
  muted_until?: string
  is_banned?: boolean
  banned_until?: string
  ban_reason?: string
  last_message_at?: string
  message_count?: number
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
  temporary?: boolean
  is_unique?: boolean
}

export interface UserPresence {
  user_id: string
  status: 'online' | 'offline' | 'away' | 'busy' | 'invisible'
  last_seen: string
  room_id?: string
  custom_status?: string
  activities?: UserActivity[]
}

export interface UserActivity {
  id: string
  user_id: string
  type: 'playing' | 'streaming' | 'listening' | 'watching' | 'custom'
  name: string
  details?: string
  state?: string
  url?: string
  created_at: string
}

export interface RoomCategory {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  position: number
  created_at: string
}

export interface UserSettings {
  user_id: string
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  notification_settings: {
    message_notifications: 'all' | 'mentions' | 'none'
    sound_enabled: boolean
    desktop_notifications: boolean
    email_notifications: boolean
    mention_notifications: boolean
    friend_request_notifications: boolean
  }
  privacy_settings: {
    show_online_status: boolean
    show_current_activity: boolean
    allow_friend_requests: boolean
    allow_direct_messages: boolean
  }
  accessibility_settings: {
    reduce_motion: boolean
    high_contrast: boolean
    large_text: boolean
  }
}

export interface UserRelationship {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'message' | 'mention' | 'reaction' | 'friend_request' | 'room_invite' | 'system'
  title: string
  content: string
  data?: any
  is_read: boolean
  created_at: string
  expires_at?: string
}

// Enhanced real-time message subscription
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: roomId 
            ? `room_id=eq.${roomId}`
            : `or(and(sender_id.eq.${userId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${userId}))`
        },
        (payload: any) => {
          // Handle message deletion
          console.log('Message deleted:', payload.old)
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
  onMemberLeave: (memberId: string) => void,
  onMemberUpdate: (member: RoomMember) => void
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`
        },
        (payload: any) => {
          onMemberUpdate(payload.new as RoomMember)
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

// Real-time reaction subscription
export function subscribeToReactions(
  messageId: string,
  onReactionAdd: (reaction: MessageReaction) => void,
  onReactionRemove: (reactionId: string) => void
) {
  try {
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        (payload: any) => {
          onReactionAdd(payload.new as MessageReaction)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        },
        (payload: any) => {
          onReactionRemove(payload.old.id)
        }
      )
      .subscribe()

    return channel
  } catch (error) {
    console.warn('Reaction real-time subscription failed:', error)
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

// Enhanced message functions
export async function sendMessage(messageData: {
  content: string
  room_id?: string
  recipient_id?: string
  reply_to?: string
  attachments?: Omit<MessageAttachment, 'id' | 'message_id' | 'created_at'>[]
  mentions?: string[]
}) {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert([{
        content: messageData.content,
        room_id: messageData.room_id,
        recipient_id: messageData.recipient_id,
        reply_to: messageData.reply_to,
        mentions: messageData.mentions
      }])
      .select()
      .single()

    if (error) throw error

    // Handle attachments if any
    if (messageData.attachments && messageData.attachments.length > 0) {
      const attachments = messageData.attachments.map(attachment => ({
        ...attachment,
        message_id: message.id
      }))

      await supabase
        .from('message_attachments')
        .insert(attachments)
    }

    return message
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export async function editMessage(messageId: string, content: string) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .update({
        content,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error editing message:', error)
    throw error
  }
}

export async function deleteMessage(messageId: string) {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

export async function addReaction(messageId: string, emoji: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .insert([{
        message_id: messageId,
        emoji,
        user_id: userId
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error adding reaction:', error)
    throw error
  }
}

export async function removeReaction(messageId: string, emoji: string, userId: string) {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('emoji', emoji)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error removing reaction:', error)
    throw error
  }
}

export async function updateUserStatus(userId: string, status: User['status'], customStatus?: string) {
  try {
    const { data, error } = await supabase
      .from('user_presence')
      .upsert([{
        user_id: userId,
        status,
        custom_status: customStatus,
        last_seen: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating user status:', error)
    throw error
  }
}

export async function uploadFile(file: File, bucket: string = 'attachments') {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${Date.now()}_${fileName}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return {
      url: publicUrl,
      path: filePath,
      size: file.size,
      type: file.type
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
} 
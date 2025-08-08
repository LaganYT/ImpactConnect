'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import SettingsPanel from './SettingsPanel'
import RoomMembersSidebar from './RoomMembersSidebar'
import Modal from './Modal'
import { ChatSession, Room } from '@/lib/types'
import { emailToUsername } from '@/lib/usernames'
import styles from './ChatLayout.module.css'

interface ChatLayoutProps {
  user: User
  selectedChatId?: string
}

export default function ChatLayout({ user, selectedChatId }: ChatLayoutProps) {
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const supabase = createClient()

  // Track window focus/visibility to avoid noisy notifications
  const [isWindowFocused, setIsWindowFocused] = useState(true)
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false)

  // Refs to avoid stale closures in realtime callbacks
  const selectedChatRef = useRef<ChatSession | null>(null)
  const chatSessionsRef = useRef<ChatSession[]>([])
  const isWindowFocusedRef = useRef<boolean>(true)
  const userIdRef = useRef<string>(user.id)

  useEffect(() => {
    fetchChatSessions()
    const cleanup = setupRealtimeSubscriptions()
    return () => {
      if (typeof cleanup === 'function') cleanup()
    }
  }, [])

  // Keep refs in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    chatSessionsRef.current = chatSessions
  }, [chatSessions])

  useEffect(() => {
    isWindowFocusedRef.current = isWindowFocused
  }, [isWindowFocused])

  // Track window focus and request notifications
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true)
    const handleBlur = () => setIsWindowFocused(false)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Initialize notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        setHasNotificationPermission(Notification.permission === 'granted')
        if (Notification.permission === 'default') {
          Notification.requestPermission().then((perm) => {
            setHasNotificationPermission(perm === 'granted')
          }).catch(() => {})
        }
      } catch {}
    }

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Sync selection from selectedChatId when sessions load or id changes
  useEffect(() => {
    if (!selectedChatId) return
    if (chatSessions.length === 0) return
    const found = chatSessions.find((c) => c.id === selectedChatId)
    if (found) setSelectedChat(found)
  }, [selectedChatId, chatSessions])

  const fetchChatSessions = async () => {
    try {
      // Fetch direct messages (no joins to avoid RLS issues)
      const { data: dms, error: dmError } = await supabase
        .from('direct_messages')
        .select(`id, user1_id, user2_id, created_at, updated_at`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

      if (dmError) throw dmError

      // Fetch rooms directly; RLS should filter to only rooms the user can see
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('id, name, description, created_at, updated_at, is_private, invite_code, created_by')

      if (roomError) throw roomError

      // For DMs: fetch partner usernames to label as "DM with [partner]"
      const dmSessions: ChatSession[] = []
      for (const dm of (dms || [])) {
        const partnerId = dm.user1_id === user.id ? dm.user2_id : dm.user1_id
        let partnerName = 'Unknown'
        try {
          const { data: partner } = await supabase
            .from('users')
            .select('username, email')
            .eq('id', partnerId)
            .maybeSingle()
          partnerName = partner?.username || (partner?.email ? (emailToUsername(partner.email) || partner.email) : 'Unknown')
        } catch {}
        dmSessions.push({
          id: dm.id,
          type: 'dm',
          name: `DM with ${partnerName}`,
          unread_count: 0
        })
      }

      const roomSessions: ChatSession[] = rooms?.map((rm: Room) => ({
        id: rm.id,
        type: 'room',
        name: rm.name,
        inviteCode: rm.invite_code,
        unread_count: 0,
        isOwner: rm.created_by === user.id
      })) || []

      setChatSessions([...dmSessions, ...roomSessions])
    } catch (error) {
      console.error('Error fetching chat sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to new messages (RLS ensures only messages user can view)
    const messagesSubscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const message = payload.new as unknown as {
            id: string
            content: string
            sender_id: string
            sender_name?: string | null
            sender_username?: string | null
            room_id?: string | null
            direct_message_id?: string | null
          }

          // Ignore messages sent by the current user
          if (!message || message.sender_id === userIdRef.current) return

          const targetChatId = message.room_id || message.direct_message_id
          if (!targetChatId) return

          // Only notify if
          // - notification permission granted
          // - window not focused OR user is not already viewing this chat
          const permissionOk = hasNotificationPermission || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted')
          if (!permissionOk) return

          const isViewingThisChat = selectedChatRef.current?.id === targetChatId
          const shouldNotify = !isWindowFocusedRef.current || !isViewingThisChat
          if (!shouldNotify) return

          // Find session name for title
          const session = chatSessionsRef.current.find((s) => s.id === targetChatId)
          const title = session ? session.name : 'New message'

          const senderLabel = message.sender_username || message.sender_name || 'Someone'
          const body = `${senderLabel}: ${message.content}`

          try {
            const notif = new Notification(title, {
              body,
            })
            notif.onclick = () => {
              try {
                window.focus()
              } catch {}
              if (window.location.pathname !== `/chat/${targetChatId}`) {
                window.location.href = `/chat/${targetChatId}`
              }
              try { notif.close() } catch {}
            }
          } catch (e) {
            // Silently ignore if notifications fail
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesSubscription)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading chat...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Sidebar
        user={user}
        chatSessions={chatSessions}
        selectedChat={selectedChat}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatWindow
        user={user}
        selectedChat={selectedChat}
        onSendMessage={async (content: string) => {
          if (!selectedChat) return
          
          // Fetch sender's canonical username from profile
          const { data: profile } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle()

          const senderUsername = profile?.username || emailToUsername(user.email) || null

          const { error } = await supabase
            .from('messages')
            .insert({
              content,
              sender_id: user.id,
              sender_name: (user.user_metadata as { full_name?: string })?.full_name || null,
              sender_email: user.email || null,
              sender_username: senderUsername,
              [selectedChat.type === 'dm' ? 'direct_message_id' : 'room_id']: selectedChat.id
            })

          if (error) {
            console.error('Error sending message:', error)
          }
        }}
        />
        {showSettings && (
          <Modal open={showSettings} title="Settings" onClose={() => setShowSettings(false)}>
            <SettingsPanel />
          </Modal>
        )}
      </div>
      <RoomMembersSidebar user={user} selectedChat={selectedChat} />
    </div>
  )
} 
'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import SettingsPanel from './SettingsPanel'
import Modal from './Modal'
import { ChatSession } from '@/lib/types'
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

  useEffect(() => {
    fetchChatSessions()
    setupRealtimeSubscriptions()
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
        .select('id, name, description, created_at, updated_at, is_private, invite_code')

      if (roomError) throw roomError

      // Transform data into ChatSession format (placeholder names for DMs)
      const dmSessions: ChatSession[] = dms?.map(dm => {
        const otherUserId = dm.user1_id === user.id ? dm.user2_id : dm.user1_id
        // Best-effort: if current user, show their own username as context
        const selfUsername = emailToUsername(user.email) || 'you'
        return {
          id: dm.id,
          type: 'dm',
          name: `DM with ${selfUsername}`,
          unread_count: 0
        }
      }) || []

      const roomSessions: ChatSession[] = rooms?.map((rm: any) => ({
        id: rm.id,
        type: 'room',
        name: rm.name,
        inviteCode: rm.invite_code,
        unread_count: 0
      })) || []

      setChatSessions([...dmSessions, ...roomSessions])
    } catch (error) {
      console.error('Error fetching chat sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // Handle new message
        console.log('New message:', payload)
        // Update chat sessions and current chat if needed
      })
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.66,1H10.34a.5.5,0,0,0-.49.41L9.47,4.06a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.41h3.32a.5.5,0,0,0,.49-.41l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>
          </button>
        </div>
        <ChatWindow
        user={user}
        selectedChat={selectedChat}
        onSendMessage={async (content) => {
          if (!selectedChat) return
          
          const { error } = await supabase
            .from('messages')
            .insert({
              content,
              sender_id: user.id,
              sender_name: (user.user_metadata as any)?.full_name || null,
              sender_email: user.email || null,
              sender_username: emailToUsername(user.email),
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
    </div>
  )
} 
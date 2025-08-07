'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import { ChatSession } from '@/lib/types'
import styles from './ChatLayout.module.css'

interface ChatLayoutProps {
  user: User
}

export default function ChatLayout({ user }: ChatLayoutProps) {
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchChatSessions()
    setupRealtimeSubscriptions()
  }, [])

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
        return {
          id: dm.id,
          type: 'dm',
          name: `DM with ${otherUserId.slice(0, 6)}`,
          unread_count: 0
        }
      }) || []

      const roomSessions: ChatSession[] = rooms?.map((rm: any) => ({
        id: rm.id,
        type: 'room',
        name: rm.name,
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
        onSelectChat={setSelectedChat}
        onLogout={handleLogout}
      />
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
              [selectedChat.type === 'dm' ? 'direct_message_id' : 'room_id']: selectedChat.id
            })

          if (error) {
            console.error('Error sending message:', error)
          }
        }}
      />
    </div>
  )
} 
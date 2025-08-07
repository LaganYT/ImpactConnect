'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { ChatSession, Message } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import styles from './ChatWindow.module.css'

interface ChatWindowProps {
  user: User
  selectedChat: ChatSession | null
  onSendMessage: (content: string) => Promise<void>
}

export default function ChatWindow({
  user,
  selectedChat,
  onSendMessage
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (selectedChat) {
      fetchMessages()
      setupMessageSubscription()
    }
  }, [selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    if (!selectedChat) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`*`)
        .eq(selectedChat.type === 'dm' ? 'direct_message_id' : 'room_id', selectedChat.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupMessageSubscription = () => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`messages:${selectedChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: selectedChat.type === 'dm' 
          ? `direct_message_id=eq.${selectedChat.id}`
          : `room_id=eq.${selectedChat.id}`
      }, (payload) => {
        const newMessage = payload.new as Message
        setMessages(prev => [...prev, newMessage])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat) return

    setSending(true)
    try {
      await onSendMessage(newMessage.trim())
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!selectedChat) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>💬</div>
        <h2>Select a chat to start messaging</h2>
        <p>Choose a direct message or room from the sidebar</p>
      </div>
    )
  }

  return (
    <div className={styles.chatWindow}>
      <div className={styles.header}>
        <div className={styles.chatInfo}>
          <h2 className={styles.chatName}>{selectedChat.name}</h2>
          <p className={styles.chatType}>
            {selectedChat.type === 'dm' ? 'Direct Message' : 'Room'}
          </p>
        </div>
        {selectedChat.type === 'room' && (
          <div className={styles.roomActions}>
            <button className={styles.inviteButton}>
              Invite
            </button>
          </div>
        )}
      </div>

      <div className={styles.messagesContainer}>
        {loading ? (
          <div className={styles.loadingMessages}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${
                  message.sender_id === user.id ? styles.ownMessage : ''
                }`}
              >
                <div className={styles.messageContent}>
                  {message.sender_id !== user.id && (
                    <div className={styles.messageSender}>
                      {message.sender?.full_name || message.sender?.email || 'Unknown'}
                    </div>
                  )}
                  <div className={styles.messageText}>{message.content}</div>
                  <div className={styles.messageTime}>
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className={styles.messageForm}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className={styles.messageInput}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={styles.sendButton}
          >
            {sending ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg className={styles.sendIcon} viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  )
} 
'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { ChatSession, Message } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { emailToUsername } from '@/lib/usernames'
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
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const [readByMap, setReadByMap] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!selectedChat) return
    fetchMessages()
    const cleanupMsg = setupMessageSubscription()
    const cleanupReads = setupReadReceiptsSubscription()
    return () => {
      if (typeof cleanupMsg === 'function') cleanupMsg()
      if (typeof cleanupReads === 'function') cleanupReads()
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
        .select(`*, reads:message_reads(user_id)`) 
        .eq(selectedChat.type === 'dm' ? 'direct_message_id' : 'room_id', selectedChat.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      const msgs = (data || []) as (Message & { reads?: { user_id: string }[] })[]
      const map: Record<string, string[]> = {}
      msgs.forEach(m => { map[m.id] = (m.reads || []).map(r => r.user_id) })
      setReadByMap(map)
      setMessages(msgs)
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

  const setupReadReceiptsSubscription = () => {
    if (!selectedChat) return

    const channel = supabase
      .channel('message_reads')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads'
      }, (payload) => {
        const { message_id, user_id } = payload.new as { message_id: string, user_id: string }
        setReadByMap(prev => {
          const current = prev[message_id] || []
          if (current.includes(user_id)) return prev
          return { ...prev, [message_id]: [...current, user_id] }
        })
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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChat) return
    try {
      setUploadingImage(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/imgbb-upload', { method: 'POST', body: form })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to upload image')
      }
      const { url } = (await res.json()) as { url: string }
      await onSendMessage(url)
    } catch (err) {
      console.error('Image upload failed', err)
      alert(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    const markReadReceipts = async () => {
      if (!selectedChat || messages.length === 0) return
      const unseen = messages.filter(m => m.sender_id !== user.id && !(readByMap[m.id] || []).includes(user.id))
      if (unseen.length === 0) return
      const rows = unseen.map(m => ({ message_id: m.id, user_id: user.id }))
      await supabase.from('message_reads').upsert(rows, { onConflict: 'message_id,user_id' })
    }
    markReadReceipts()
  }, [messages, selectedChat])

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
            <button
              className={styles.inviteButton}
              onClick={async () => {
                if (!selectedChat.inviteCode) return
                const url = `${window.location.origin}/invite/${selectedChat.inviteCode}`
                try {
                  await navigator.clipboard.writeText(url)
                  alert('Invite link copied to clipboard')
                } catch {
                  prompt('Copy invite link:', url)
                }
              }}
            >
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
                  <div className={styles.messageSender}>
                    {(() => {
                      const explicitUsername = message.sender_username || null
                      const derivedUsername = message.sender_id === user.id ? emailToUsername(user.email) : null
                      const username = explicitUsername || derivedUsername || null

                      const explicitFullName = message.sender_name || null
                      const derivedFullName = message.sender_id === user.id ? (user.user_metadata as { full_name?: string })?.full_name || null : null
                      const fullName = explicitFullName || derivedFullName || null

                      if (fullName && username) return `${fullName} (${username})`
                      if (fullName) return fullName
                      if (username) return username
                      if (message.sender_email) return emailToUsername(message.sender_email) || message.sender_email
                      return message.sender_id === user.id ? 'You' : 'Unknown'
                    })()}
                  </div>
                  {/^https?:\/\//i.test(message.content) && /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\/i\.ibb\.co\/)/i.test(message.content) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.content} alt="Shared image" style={{ maxWidth: '320px', borderRadius: 12 }} />
                  ) : (
                    <div className={styles.messageText}>{message.content}</div>
                  )}
                  <div className={styles.messageTime}>
                    {formatTime(message.created_at)}
                  </div>
                  {message.sender_id === user.id && (
                    <div className={styles.readReceipt}>
                      {(() => {
                        const readers = readByMap[message.id] || []
                        if (selectedChat.type === 'dm') {
                          const read = readers.some(rid => rid !== user.id)
                          return read ? 'Read' : 'Sent'
                        }
                        const count = readers.filter(rid => rid !== user.id).length
                        return count > 0 ? `Read by ${count}` : 'Sent'
                      })()}
                    </div>
                  )}
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
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUploadImage}
          />
          <button
            type="button"
            className={styles.sendButton}
            title="Upload image"
            aria-label="Upload image"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg className={styles.sendIcon} viewBox="0 0 24 24">
                <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 6l-4-4-4 4" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2v14" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
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
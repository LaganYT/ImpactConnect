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
  type SenderLite = {
    id: string
    avatar_url?: string | null
    full_name?: string | null
    email?: string | null
    username?: string | null
  }
  type UIMessage = Omit<Message, 'sender'> & {
    sender?: SenderLite
    reads?: { user_id: string }[]
  }
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const [readByMap, setReadByMap] = useState<Record<string, string[]>>({})
  const [isWindowFocused, setIsWindowFocused] = useState(true)
  const [isTabVisible, setIsTabVisible] = useState(true)

  // Track focus/visibility to control when reads are recorded
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true)
    const handleBlur = () => setIsWindowFocused(false)
    const handleVisibilityChange = () => {
      try {
        setIsTabVisible(document.visibilityState === 'visible')
      } catch {}
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    // Initialize visibility on mount
    try {
      setIsTabVisible(document.visibilityState === 'visible')
    } catch {}
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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

  // When switching/opening a chat and after initial load completes, snap to bottom
  useEffect(() => {
    if (!selectedChat) return
    if (!loading) {
      // Delay to allow DOM to paint
      setTimeout(() => scrollToBottom(false), 0)
    }
  }, [selectedChat, loading])

  // If there are images, scroll again once they finish loading to ensure bottom stays in view
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const images: HTMLImageElement[] = Array.from(container.querySelectorAll('img'))
    if (images.length === 0) return
    const onLoad = () => scrollToBottom(false)
    images.forEach((img) => {
      if (img.complete) return
      img.addEventListener('load', onLoad)
      img.addEventListener('error', onLoad)
    })
    return () => {
      images.forEach((img) => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onLoad)
      })
    }
  }, [messages, selectedChat])

  const fetchMessages = async () => {
    if (!selectedChat) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`*, reads:message_reads(user_id), sender:users!messages_sender_id_fkey(id, avatar_url, full_name, email, username)`) 
        .eq(selectedChat.type === 'dm' ? 'direct_message_id' : 'room_id', selectedChat.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      const msgs = (data || []) as UIMessage[]
      const map: Record<string, string[]> = {}
      msgs.forEach((m) => {
        map[m.id] = (m.reads || []).map((r: { user_id: string }) => r.user_id)
      })
      setReadByMap(map)
      // Normalize sender object to expected shape (defensive)
      setMessages(msgs.map(m => ({
        ...m,
        sender: m.sender ? {
          id: m.sender.id,
          avatar_url: m.sender.avatar_url ?? null,
          full_name: m.sender.full_name ?? null,
          email: m.sender.email ?? null,
          username: m.sender.username ?? null,
        } : undefined
      })))
    } catch (error) {
      console.error('Error fetching messages:', error instanceof Error ? error.message : error)
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
      }, async (payload) => {
        const newMessage = payload.new as UIMessage
        // Hydrate sender profile for avatar/labels
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('id, avatar_url, full_name, email, username')
            .eq('id', newMessage.sender_id)
            .maybeSingle()
          if (profile) {
            const hydrated: UIMessage = {
              ...newMessage,
              sender: {
                id: profile.id,
                avatar_url: profile.avatar_url ?? null,
                full_name: profile.full_name ?? null,
                email: profile.email ?? null,
                username: profile.username ?? null,
              },
            }
            setMessages(prev => [...prev, hydrated])
            return
          }
        } catch {}
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

  const sendCurrentMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return
    setSending(true)
    try {
      await onSendMessage(newMessage.trim())
      setNewMessage('')
      // reset textarea height after send
      if (messageInputRef.current) {
        messageInputRef.current.style.height = 'auto'
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendCurrentMessage()
  }

  const autoResizeTextArea = (el: HTMLTextAreaElement) => {
    const maxHeight = 120
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
  }

  const uploadToImgbbClient = async (file: File, apiKey: string): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const result = reader.result as string
          const commaIndex = result.indexOf(',')
          const b64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result
          resolve(b64)
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

    const body = new URLSearchParams()
    body.append('image', base64)

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    type ImgbbResponse = {
      data?: { display_url?: string; url?: string; image?: { url?: string } }
    }
    const json = (await res.json().catch(() => null)) as ImgbbResponse | null
    if (!res.ok || !json) {
      throw new Error('imgbb upload failed')
    }
    const url: string | undefined = json?.data?.display_url || json?.data?.url || json?.data?.image?.url
    if (!url) throw new Error('imgbb did not return a URL')
    return url
  }

  // File uploads are restricted to images only; non-image flows removed

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChat) return
    try {
      setUploadingFile(true)
      const isImage = !!file.type?.startsWith('image/')
      const imgbbKey = process.env.NEXT_PUBLIC_IMGBB_KEY as string | undefined

      if (!isImage) {
        alert('Only image uploads are allowed')
        return
      }

      if (!imgbbKey) {
        throw new Error('Image uploads require imgbb. Missing NEXT_PUBLIC_IMGBB_KEY.')
      }
      const url = await uploadToImgbbClient(file, imgbbKey)
      await onSendMessage(url)
    } catch (err) {
      console.error('File upload failed', err)
      alert(err instanceof Error ? err.message : 'File upload failed')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const scrollToBottom = (smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const extractUrlParts = (url: string): { filename: string | null; extension: string | null; host: string | null } => {
    try {
      const u = new URL(url)
      const pathname = decodeURIComponent(u.pathname || '')
      const segments = pathname.split('/')
      const filename = segments[segments.length - 1] || null
      const match = filename ? filename.match(/\.([a-z0-9]+)(?:\?.*)?$/i) : null
      const extension = match ? match[1].toLowerCase() : null
      return { filename, extension, host: u.host || null }
    } catch {
      return { filename: null, extension: null, host: null }
    }
  }

  useEffect(() => {
    const markReadReceipts = async () => {
      if (!selectedChat || messages.length === 0) return
      // Do not mark as read unless the tab is focused and visible
      if (!isWindowFocused || !isTabVisible) return
      const unseen = messages.filter(m => m.sender_id !== user.id && !(readByMap[m.id] || []).includes(user.id))
      if (unseen.length === 0) return
      const rows = unseen.map(m => ({ message_id: m.id, user_id: user.id }))
      await supabase.from('message_reads').upsert(rows, { onConflict: 'message_id,user_id' })
    }
    markReadReceipts()
  }, [messages, selectedChat, isWindowFocused, isTabVisible])

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

      <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {loading ? (
          <div className={styles.loadingMessages}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message) => {
              const isOwn = message.sender_id === user.id
              return (
                <div
                  key={message.id}
                  className={`${styles.message} ${isOwn ? styles.ownMessage : ''}`}
                >
                  <div className={styles.messageRow}>
                    {!isOwn && (
                      <div className={styles.avatar} aria-hidden>
                        {(() => {
                          const a = message.sender?.avatar_url
                          if (a) {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            )
                          }
                          const initial = (message.sender?.full_name?.[0] || message.sender_username?.[0] || message.sender_email?.[0] || 'U').toUpperCase()
                          return initial
                        })()}
                      </div>
                    )}
                    <div className={styles.messageContent}>
                      <div className={styles.messageSender}>
                        {(() => {
                          const explicitUsername = message.sender_username || null
                          const derivedUsername = isOwn ? emailToUsername(user.email) : null
                          const username = explicitUsername || derivedUsername || null

                          const explicitFullName = message.sender_name || null
                          const derivedFullName = isOwn ? (user.user_metadata as { full_name?: string })?.full_name || null : null
                          const fullName = explicitFullName || derivedFullName || null

                          if (fullName && username) return `${fullName} (${username})`
                          if (fullName) return fullName
                          if (username) return username
                          if (message.sender_email) return emailToUsername(message.sender_email) || message.sender_email
                          return isOwn ? 'You' : 'Unknown'
                        })()}
                      </div>
                      {(() => {
                        const content = message.content
                        const isUrl = /^https?:/i.test(content)
                        if (!isUrl) return <div className={styles.messageText}>{content}</div>

                        const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif|\.svg)(?:\?.*)?$/i.test(content) || /\/i\.ibb\.co\//i.test(content)
                        if (isImage) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={content} alt="Shared image" style={{ maxWidth: '320px', borderRadius: 12 }} />
                          )
                        }

                        const { filename, extension, host } = extractUrlParts(content)
                        const isFilebin = (host || '').includes('filebin.net')

                        const isVideo = /(\.mp4|\.webm|\.ogg|\.mov|\.m4v)(?:\?.*)?$/i.test(content)
                        if (isVideo && !isFilebin) {
                          return (
                            <video src={content} controls style={{ maxWidth: 360, borderRadius: 12 }} />
                          )
                        }

                        const isAudio = /(\.mp3|\.wav|\.ogg|\.m4a|\.aac)(?:\?.*)?$/i.test(content)
                        if (isAudio && !isFilebin) {
                          return (
                            <audio src={content} controls style={{ maxWidth: 360 }} />
                          )
                        }

                        const ext = (extension || 'file').toLowerCase()
                        const icon = (() => {
                          if (['pdf'].includes(ext)) return '📄'
                          if (['doc', 'docx', 'rtf', 'odt', 'md', 'txt'].includes(ext)) return '📝'
                          if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📊'
                          if (['ppt', 'pptx', 'odp'].includes(ext)) return '📈'
                          if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return '🗜️'
                          if (['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext)) return '🎞️'
                          if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) return '🎧'
                          if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return '🖼️'
                          return '📦'
                        })()

                        return (
                          <div className={styles.fileAttachment}>
                            <div className={styles.fileIcon} aria-hidden>{icon}</div>
                            <div className={styles.fileBody}>
                              <div className={styles.fileName} title={filename || content}>
                                {filename || content}
                              </div>
                              <div className={styles.fileMeta}>
                                {ext.toUpperCase()}{host ? ` · ${host}` : ''}
                              </div>
                            </div>
                            <div className={styles.fileActions}>
                              <a href={content} target="_blank" rel="noreferrer" className={styles.fileButton}>Open</a>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    {isOwn && (
                      <div className={styles.avatar} aria-hidden>
                        {(() => {
                          const a = message.sender?.avatar_url || (user.user_metadata as { avatar_url?: string })?.avatar_url
                          if (a) {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            )
                          }
                          const fullName = (user.user_metadata as { full_name?: string })?.full_name || message.sender?.full_name || null
                          const initial = (fullName?.[0] || user.email?.[0] || message.sender_username?.[0] || 'U').toUpperCase()
                          return initial
                        })()}
                      </div>
                    )}
                  </div>
                  <div className={`${styles.metaRow} ${isOwn ? styles.metaRight : styles.metaLeft}`}>
                    <div className={styles.messageTime}>{formatTime(message.created_at)}</div>
                    {isOwn && (
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
              )
            })}
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
            onChange={handleUploadFile}
          />
          <button
            type="button"
            className={styles.sendButton}
            title="Upload file"
            aria-label="Upload file"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg className={styles.sendIcon} viewBox="0 0 24 24">
                <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 6l-4-4-4 4" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2v14" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            )}
          </button>
          <textarea
            ref={messageInputRef}
            rows={1}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              autoResizeTextArea(e.currentTarget)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!sending && newMessage.trim()) {
                  void sendCurrentMessage()
                }
              }
            }}
            placeholder="Type a message..."
            className={styles.messageInput}
            disabled={sending}
            style={{ overflow: 'hidden' }}
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
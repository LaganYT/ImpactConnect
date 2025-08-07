'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { realtimeService } from '@/lib/realtime'
import { Button } from '@/components/ui/Button'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  MessageSquare, 
  User, 
  Hash
} from 'lucide-react'
import { Message, Room, User as UserType } from '@/lib/supabase'
import { formatTime, truncateText } from '@/lib/utils'

interface ChatAreaProps {
  selectedRoom: string | null
  selectedUser: string | null
  currentUser: UserType | null
}

export function ChatArea({ selectedRoom, selectedUser, currentUser }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [roomInfo, setRoomInfo] = useState<Room | null>(null)
  const [userInfo, setUserInfo] = useState<UserType | null>(null)
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string; avatar_url?: string }>>([])
  const [replyTo, setReplyTo] = useState<{ message: string; sender: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRoom || selectedUser) {
      fetchMessages()
      if (selectedRoom) {
        fetchRoomInfo()
      } else if (selectedUser) {
        fetchUserInfo()
      }
    } else {
      setMessages([])
      setRoomInfo(null)
      setUserInfo(null)
    }
  }, [selectedRoom, selectedUser])

  // Set up real-time subscription with fallback
  useEffect(() => {
    if (!selectedRoom && !selectedUser) return

    const unsubscribe = realtimeService.subscribeToMessages(
      selectedRoom,
      selectedUser,
      (newMessage: Message) => {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(msg => msg.id === newMessage.id)
          if (!exists) {
            return [...prev, newMessage]
          }
          return prev
        })
      }
    )

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [selectedRoom, selectedUser])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (selectedRoom) {
        query = query.eq('room_id', selectedRoom)
      } else if (selectedUser) {
        query = query.or(`and(sender_id.eq.${currentUser?.id},recipient_id.eq.${selectedUser}),and(sender_id.eq.${selectedUser},recipient_id.eq.${currentUser?.id})`)
      }

      const { data } = await query
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const fetchRoomInfo = async () => {
    if (!selectedRoom) return
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', selectedRoom)
      .single()
    setRoomInfo(data)
  }

  const fetchUserInfo = async () => {
    if (!selectedUser) return
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', selectedUser)
      .single()
    setUserInfo(data)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentUser) return

    setLoading(true)
    try {
      const messageData = {
        content: content.trim(),
        sender_id: currentUser.id,
        ...(selectedRoom ? { room_id: selectedRoom } : { recipient_id: selectedUser })
      }

      const { error } = await supabase
        .from('messages')
        .insert([messageData])

      if (error) throw error

      // Clear reply if it exists
      setReplyTo(null)
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = (message: Message) => {
    const senderName = message.sender_id === currentUser?.id ? 'yourself' : 'this message'
    setReplyTo({
      message: message.content,
      sender: senderName
    })
  }

  const handleReaction = async (messageId: string, reaction: string) => {
    // Simplified reaction handling
    console.log('Reaction:', reaction, 'on message:', messageId)
  }

  const handleMessageSelect = (messageId: string) => {
    // Simplified message selection
    console.log('Selected message:', messageId)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (!selectedRoom && !selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Welcome to ImpactConnect
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Select a room or user to start messaging
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center gap-3">
          {selectedRoom ? (
            <>
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Hash className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {roomInfo?.name || 'Loading...'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {roomInfo?.description || 'No description'}
                </p>
              </div>
            </>
          ) : (
            <>
              <Avatar
                src={userInfo?.avatar_url}
                fallback={userInfo?.full_name || 'User'}
                size="lg"
              />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userInfo?.full_name || 'Loading...'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Direct Message
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No messages yet
            </h3>
            <p className="text-muted-foreground">
              Start the conversation by sending a message!
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.sender_id === currentUser?.id
            const showAvatar = index === 0 || 
              messages[index - 1]?.sender_id !== message.sender_id ||
              new Date(message.created_at).getTime() - new Date(messages[index - 1]?.created_at).getTime() > 5 * 60 * 1000 // 5 minutes
            
            return (
              <div key={message.id} id={`message-${message.id}`}>
                <MessageBubble
                  message={message}
                  sender={isOwnMessage ? currentUser! : (userInfo || { id: message.sender_id, full_name: 'Unknown User', email: '', created_at: '' })}
                  currentUser={currentUser!}
                  isOwnMessage={isOwnMessage}
                  showAvatar={showAvatar}
                  onReply={handleReply}
                  onReaction={handleReaction}
                  onEdit={(messageId, newContent) => {
                    // Update message in local state
                    setMessages(prev => prev.map(msg => 
                      msg.id === messageId ? { ...msg, content: newContent, edited_at: new Date().toISOString() } : msg
                    ))
                  }}
                  onDelete={(messageId) => {
                    // Remove message from local state
                    setMessages(prev => prev.filter(msg => msg.id !== messageId))
                  }}
                  onPin={(messageId) => {
                    // Handle message pinning
                    console.log('Message pinned:', messageId)
                  }}
                />
              </div>
            )
          })
        )}
        
        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={sendMessage}
        onTyping={(isTyping) => {
          // In a real app, you'd broadcast typing status to other users
          console.log('Typing:', isTyping)
        }}
        disabled={loading}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  )
} 
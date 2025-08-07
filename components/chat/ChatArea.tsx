'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { realtimeService } from '@/lib/realtime'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { MessageSearch } from './MessageSearch'
import { InviteManager } from './InviteManager'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  MessageSquare, 
  User, 
  Hash, 
  MoreVertical,
  Search,
  Users,
  Settings,
  Phone,
  Video
} from 'lucide-react'
import { Message, Room, User as UserType, RoomMember } from '@/lib/supabase'
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
  const [showSearch, setShowSearch] = useState(false)
  const [showInviteManager, setShowInviteManager] = useState(false)
  const [allUsers, setAllUsers] = useState<UserType[]>([])
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRoom || selectedUser) {
      fetchMessages()
      fetchAllUsers()
      if (selectedRoom) {
        fetchRoomInfo()
        fetchRoomMembers()
      } else if (selectedUser) {
        fetchUserInfo()
      }
    } else {
      setMessages([])
      setRoomInfo(null)
      setUserInfo(null)
      setRoomMembers([])
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

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('full_name')
    setAllUsers(data || [])
  }

  const fetchRoomMembers = async () => {
    if (!selectedRoom) return
    const { data } = await supabase
      .from('room_members')
      .select(`
        *,
        users (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('room_id', selectedRoom)
    setRoomMembers(data || [])
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
    const sender = message.sender_id === currentUser?.id ? 'You' : 
                  (selectedRoom ? 'Someone' : userInfo?.full_name || 'User')
    setReplyTo({
      message: message.content,
      sender
    })
  }

  const handleReaction = async (messageId: string, reaction: string) => {
    // In a real app, you'd store reactions in the database
    console.log('Reaction:', reaction, 'on message:', messageId)
  }

  const handleMessageSelect = (messageId: string) => {
    // Scroll to the selected message
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      messageElement.classList.add('ring-2', 'ring-primary', 'ring-opacity-50')
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50')
      }, 3000)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (!selectedRoom && !selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <MessageSquare className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome to ImpactConnect
          </h2>
          <p className="text-muted-foreground max-w-md">
            Select a room or start a direct message to begin chatting with others.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-6 border-b bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              src={selectedRoom ? undefined : userInfo?.avatar_url}
              fallback={selectedRoom ? roomInfo?.name : userInfo?.full_name}
              size="lg"
              className={selectedRoom ? 'bg-gradient-to-br from-primary to-primary-hover' : ''}
            />
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {selectedRoom ? roomInfo?.name : userInfo?.full_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedRoom 
                  ? `${roomInfo?.description || 'No description'} • ${messages.length} messages`
                  : 'Direct message'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content="Search messages">
              <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
                <Search className="w-4 h-4" />
              </Button>
            </Tooltip>
            {selectedRoom && (
              <Tooltip content="Invite people">
                <Button variant="ghost" size="icon" onClick={() => setShowInviteManager(true)}>
                  <Users className="w-4 h-4" />
                </Button>
              </Tooltip>
            )}
            {selectedUser && (
              <>
                <Tooltip content="Voice call">
                  <Button variant="ghost" size="icon">
                    <Phone className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content="Video call">
                  <Button variant="ghost" size="icon">
                    <Video className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </>
            )}
            <Tooltip content="More options">
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
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

      {/* Search Modal */}
      {showSearch && (
        <MessageSearch
          messages={messages}
          users={allUsers}
          onClose={() => setShowSearch(false)}
          onMessageSelect={handleMessageSelect}
        />
      )}

      {/* Invite Manager Modal */}
      {showInviteManager && roomInfo && (
        <InviteManager
          roomId={selectedRoom!}
          roomName={roomInfo.name}
          onClose={() => setShowInviteManager(false)}
        />
      )}
    </div>
  )
} 
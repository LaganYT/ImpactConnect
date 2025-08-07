'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { 
  Heart, 
  ThumbsUp, 
  Smile, 
  MoreVertical, 
  Reply,
  Clock,
  Check,
  CheckCheck
} from 'lucide-react'
import { Message, User } from '@/lib/supabase'
import { formatTime } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  sender: User
  currentUser: User
  isOwnMessage: boolean
  showAvatar?: boolean
  onReply?: (message: Message) => void
  onReaction?: (messageId: string, reaction: string) => void
}

export function MessageBubble({ 
  message, 
  sender, 
  currentUser, 
  isOwnMessage, 
  showAvatar = true,
  onReply,
  onReaction
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const reactions = [
    { emoji: '👍', label: 'Thumbs Up' },
    { emoji: '❤️', label: 'Heart' },
    { emoji: '😊', label: 'Smile' },
    { emoji: '🎉', label: 'Party' },
    { emoji: '👏', label: 'Clap' },
    { emoji: '🔥', label: 'Fire' }
  ]

  const getMessageStatus = () => {
    // Simulate message status - in real app, this would come from the database
    const now = new Date()
    const messageTime = new Date(message.created_at)
    const diffMinutes = (now.getTime() - messageTime.getTime()) / (1000 * 60)
    
    if (diffMinutes < 1) return 'sending'
    if (diffMinutes < 2) return 'sent'
    return 'delivered'
  }

  const statusIcon = {
    sending: <Clock className="w-3 h-3 text-muted-foreground" />,
    sent: <Check className="w-3 h-3 text-muted-foreground" />,
    delivered: <CheckCheck className="w-3 h-3 text-primary" />
  }

  return (
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
      {showAvatar && !isOwnMessage && (
        <Avatar
          src={sender.avatar_url}
          fallback={sender.full_name}
          size="sm"
          className="mt-1"
        />
      )}
      
      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {!isOwnMessage && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {sender.full_name}
            </span>
            <Tooltip content={formatTime(message.created_at, true)}>
              <span className="text-xs text-muted-foreground">
                {formatTime(message.created_at, true)}
              </span>
            </Tooltip>
          </div>
        )}
        
        <div className="relative group">
          <div
            className={`
              px-4 py-2 rounded-2xl break-words
              ${isOwnMessage 
                ? 'bg-primary text-primary-foreground rounded-br-md' 
                : 'bg-muted text-foreground rounded-bl-md'
              }
            `}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
          >
            <p className="text-sm leading-relaxed">{message.content}</p>
            
            {/* Message status for own messages */}
            {isOwnMessage && (
              <div className="flex items-center justify-end gap-1 mt-1">
                {statusIcon[getMessageStatus()]}
              </div>
            )}
          </div>

          {/* Message actions menu */}
          {showMenu && (
            <div className={`
              absolute top-0 z-10 flex items-center gap-1 p-1 rounded-lg bg-background border shadow-lg
              ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'}
            `}>
              <Tooltip content="Reply">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => onReply?.(message)}
                >
                  <Reply className="w-3 h-3" />
                </Button>
              </Tooltip>
              
              <Tooltip content="React">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={() => setShowReactions(!showReactions)}
                >
                  <Smile className="w-3 h-3" />
                </Button>
              </Tooltip>
              
              <Tooltip content="More">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </Tooltip>
            </div>
          )}

          {/* Reactions popup */}
          {showReactions && (
            <div className={`
              absolute top-0 z-20 flex items-center gap-1 p-2 rounded-lg bg-background border shadow-lg
              ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'}
            `}>
              {reactions.map((reaction) => (
                <Tooltip key={reaction.label} content={reaction.label}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-lg hover:scale-110 transition-transform"
                    onClick={() => {
                      onReaction?.(message.id, reaction.emoji)
                      setShowReactions(false)
                    }}
                  >
                    {reaction.emoji}
                  </Button>
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        {/* Message reactions display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {message.reactions.map((reaction, index) => (
              <Badge key={index} variant="secondary" size="sm">
                {reaction.emoji} {reaction.count}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 
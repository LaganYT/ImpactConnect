'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Reply, 
  Pin, 
  Flag,
  Smile,
  Image,
  File,
  Music,
  Download,
  Eye,
  EyeOff,
  Check,
  X
} from 'lucide-react'
import { Message, User } from '@/lib/supabase'
import { formatTime, formatFileSize } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  sender: User
  currentUser: User
  isOwnMessage: boolean
  showAvatar: boolean
  onReply: (message: Message) => void
  onReaction: (messageId: string, reaction: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onDelete?: (messageId: string) => void
  onPin?: (messageId: string) => void
}

export function MessageBubble({
  message,
  sender,
  currentUser,
  isOwnMessage,
  showAvatar,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  onPin
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const editInputRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.setSelectionRange(editContent.length, editContent.length)
    }
  }, [isEditing])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent === message.content) {
      setIsEditing(false)
      return
    }

    try {
      await onEdit(message.id, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Error editing message:', error)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (confirm('Are you sure you want to delete this message?')) {
      try {
        await onDelete(message.id)
      } catch (error) {
        console.error('Error deleting message:', error)
      }
    }
  }

  const handlePin = async () => {
    if (!onPin) return

    try {
      await onPin(message.id)
    } catch (error) {
      console.error('Error pinning message:', error)
    }
  }

  return (
    <div className={`group flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      {showAvatar && (
        <Avatar
          src={sender.avatar_url}
          fallback={sender.full_name}
          size="sm"
          className="mt-1"
        />
      )}
      
      <div className={`flex-1 max-w-[70%] ${!showAvatar ? 'ml-11' : ''}`}>
        {showAvatar && (
          <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {sender.display_name || sender.full_name}
            </span>
            <span className="text-xs text-gray-500">
              {formatTime(message.created_at)}
            </span>
            {message.edited_at && (
              <span className="text-xs text-gray-400">(edited)</span>
            )}
            {message.is_pinned && (
              <Badge variant="secondary" size="sm" className="text-xs">
                <Pin className="w-3 h-3 mr-1" />
                Pinned
              </Badge>
            )}
          </div>
        )}

        <ContextMenu
          items={[
            {
              label: 'Reply',
              icon: <Reply className="w-4 h-4" />,
              onClick: () => onReply(message)
            },
            ...(isOwnMessage ? [
              { separator: true },
              {
                label: 'Edit Message',
                icon: <Edit className="w-4 h-4" />,
                onClick: () => setIsEditing(true),
                disabled: !onEdit
              },
              {
                label: 'Delete Message',
                icon: <Trash2 className="w-4 h-4" />,
                onClick: () => handleDelete(),
                danger: true,
                disabled: !onDelete
              }
            ] : []),
            { separator: true },
            {
              label: 'Copy Message',
              icon: <File className="w-4 h-4" />,
              onClick: () => navigator.clipboard.writeText(message.content)
            }
          ].filter(Boolean)}
        >
          <div className={`relative ${isOwnMessage ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'} rounded-lg p-3`}>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  ref={editInputRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-transparent border-none outline-none resize-none text-sm"
                  rows={Math.max(1, editContent.split('\n').length)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEdit()
                    }
                    if (e.key === 'Escape') {
                      setIsEditing(false)
                      setEditContent(message.content)
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleEdit}>
                    <Check className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setIsEditing(false)
                    setEditContent(message.content)
                  }}>
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            )}

            {/* Simple Message Actions */}
            <div className={`absolute top-2 ${isOwnMessage ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
                <Tooltip content="Reply">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onReply(message)}
                    className="w-8 h-8"
                  >
                    <Reply className="w-4 h-4" />
                  </Button>
                </Tooltip>
                
                {isOwnMessage && onEdit && (
                  <Tooltip content="Edit">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                      className="w-8 h-8"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}

                {isOwnMessage && onDelete && (
                  <Tooltip content="Delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDelete}
                      className="w-8 h-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </ContextMenu>
      </div>
    </div>
  )
} 
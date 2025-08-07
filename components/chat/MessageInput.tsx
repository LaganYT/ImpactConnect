'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  Send, 
  Smile, 
  Paperclip, 
  Mic, 
  Image, 
  File,
  X
} from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  onTyping?: (isTyping: boolean) => void
  placeholder?: string
  disabled?: boolean
  replyTo?: { message: string; sender: string } | null
  onCancelReply?: () => void
}

export function MessageInput({ 
  onSendMessage, 
  onTyping, 
  placeholder = "Type a message...",
  disabled = false,
  replyTo,
  onCancelReply
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const emojis = [
    '😊', '😂', '❤️', '👍', '🎉', '🔥', '👏', '🙏',
    '😍', '🤔', '😭', '😡', '🤗', '😴', '🤯', '🥳',
    '😎', '🤩', '😇', '🤪', '😋', '🤓', '😤', '😅'
  ]

  useEffect(() => {
    if (isTyping) {
      onTyping?.(true)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
        onTyping?.(false)
      }, 1000)
    }
  }, [isTyping, onTyping])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)
    setIsTyping(value.length > 0)
  }

  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
      setIsTyping(false)
      onTyping?.(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const addEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div className="border-t bg-background p-4">
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-3 p-3 bg-muted rounded-lg relative">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Replying to {replyTo.sender}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {replyTo.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6"
              onClick={onCancelReply}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted rounded-lg"
            >
              <File className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground truncate max-w-32">
                {file.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-4 h-4"
                onClick={() => removeFile(index)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Input
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-20"
          />
          
          {/* Emoji picker */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-background border rounded-lg shadow-lg grid grid-cols-8 gap-1 z-10">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  className="w-8 h-8 text-lg hover:bg-muted rounded transition-colors"
                  onClick={() => addEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip content="Add emoji">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-5 h-5" />
            </Button>
          </Tooltip>

          <Tooltip content="Attach file">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
          </Tooltip>

          <Tooltip content="Voice message">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10"
            >
              <Mic className="w-5 h-5" />
            </Button>
          </Tooltip>

          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || disabled}
            className="w-10 h-10"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />
    </div>
  )
} 
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  Send
} from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  onTyping?: (isTyping: boolean) => void
  disabled?: boolean
  replyTo?: { message: string; sender: string } | null
  onCancelReply?: () => void
  placeholder?: string
}

export function MessageInput({
  onSendMessage,
  onTyping,
  disabled = false,
  replyTo,
  onCancelReply,
  placeholder = "Type a message..."
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  useEffect(() => {
    let typingTimeout: NodeJS.Timeout
    if (isTyping) {
      typingTimeout = setTimeout(() => {
        setIsTyping(false)
        onTyping?.(false)
      }, 1000)
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    }
  }, [isTyping, onTyping])

  const handleSend = async () => {
    if (!message.trim() || disabled) return

    const content = message.trim()
    setMessage('')
    setIsTyping(false)
    onTyping?.(false)
    
    try {
      await onSendMessage(content)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)
    
    if (!isTyping && value.trim()) {
      setIsTyping(true)
      onTyping?.(true)
    } else if (isTyping && !value.trim()) {
      setIsTyping(false)
      onTyping?.(false)
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      {/* Reply Preview */}
      {replyTo && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Replying to {replyTo.sender}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 truncate">
                {replyTo.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span className="text-lg">×</span>
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full resize-none bg-transparent border-none outline-none text-sm placeholder-gray-500 dark:placeholder-gray-400 min-h-[20px] max-h-32"
            rows={1}
          />
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
} 
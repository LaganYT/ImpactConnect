'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  Search, 
  X, 
  ArrowUp, 
  ArrowDown,
  MessageSquare
} from 'lucide-react'
import { Message, User } from '@/lib/supabase'
import { formatTime } from '@/lib/utils'

interface MessageSearchProps {
  messages: Message[]
  users: User[]
  onClose: () => void
  onMessageSelect: (messageId: string) => void
}

export function MessageSearch({ messages, users, onClose, onMessageSelect }: MessageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Message[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (searchTerm.trim()) {
      const results = messages.filter(message =>
        message.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setSearchResults(results)
      setSelectedIndex(0)
    } else {
      setSearchResults([])
      setSelectedIndex(0)
    }
  }, [searchTerm, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev < searchResults.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : searchResults.length - 1
      )
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault()
      onMessageSelect(searchResults[selectedIndex].id)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const getUserById = (userId: string) => {
    return users.find(user => user.id === userId) || {
      id: userId,
      full_name: 'Unknown User',
      email: '',
      created_at: ''
    }
  }

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Search Messages</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {searchTerm && searchResults.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No messages found</p>
            </div>
          ) : searchTerm && searchResults.length > 0 ? (
            <div className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </p>
              {searchResults.map((message, index) => {
                const user = getUserById(message.sender_id)
                const isSelected = index === selectedIndex
                
                return (
                  <div
                    key={message.id}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-colors
                      ${isSelected ? 'bg-muted' : 'hover:bg-muted/50'}
                    `}
                    onClick={() => {
                      onMessageSelect(message.id)
                      onClose()
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={user.avatar_url}
                        fallback={user.full_name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {user.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {highlightText(message.content, searchTerm)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ArrowUp className="w-3 h-3" />
                          <ArrowDown className="w-3 h-3" />
                          <span>Enter</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Start typing to search messages</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
            <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 
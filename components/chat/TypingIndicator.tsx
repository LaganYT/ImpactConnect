'use client'

import { Avatar } from '@/components/ui/Avatar'

interface TypingIndicatorProps {
  users: Array<{ id: string; name: string; avatar_url?: string }>
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user, index) => (
          <Avatar
            key={user.id}
            src={user.avatar_url}
            fallback={user.name}
            size="sm"
            className="border-2 border-background"
          />
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {users.length === 1 
            ? `${users[0].name} is typing...`
            : `${users.length} people are typing...`
          }
        </span>
        
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
} 
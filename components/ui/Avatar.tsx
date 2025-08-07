import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'away' | 'busy'
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', status, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg'
    }

    const statusClasses = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      away: 'bg-yellow-500',
      busy: 'bg-red-500'
    }

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    return (
      <div className={cn("relative inline-block", className)} ref={ref} {...props}>
        <div className={cn(
          "relative rounded-full overflow-hidden bg-muted flex items-center justify-center",
          sizeClasses[size]
        )}>
          {src ? (
            <img
              src={src}
              alt={alt || 'Avatar'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={cn(
            "w-full h-full flex items-center justify-center font-medium text-muted-foreground",
            src ? 'hidden' : ''
          )}>
            {fallback ? getInitials(fallback) : 'U'}
          </div>
        </div>
        {status && (
          <div className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
            statusClasses[status]
          )} />
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export { Avatar } 
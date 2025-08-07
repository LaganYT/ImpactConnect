export function formatTime(date: string | Date, p0: boolean) {
  const d = new Date(date)
  const now = new Date()
  const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else {
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Utility for conditional classNames (tailwind, etc)
export function cn(...args: any[]): string {
  return args
    .flat(Infinity)
    .filter(Boolean)
    .map(arg => {
      if (typeof arg === 'string') return arg
      if (typeof arg === 'object') {
        return Object.entries(arg)
          .filter(([_, value]) => Boolean(value))
          .map(([key]) => key)
          .join(' ')
      }
      return ''
    })
    .filter(Boolean)
    .join(' ')
}
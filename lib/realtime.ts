import { supabase, Message } from './supabase'
import { WebSocketService } from './websocket'

export interface RealtimeOptions {
  pollingInterval?: number
  enableWebSocket?: boolean
  webSocketUrl?: string
  enableSSE?: boolean
  sseUrl?: string
}

export class RealtimeService {
  private pollingInterval: number
  private enableWebSocket: boolean
  private webSocketUrl?: string
  private enableSSE: boolean
  private sseUrl?: string
  
  private activeSubscriptions: Map<string, () => void> = new Map()
  private webSocketService?: WebSocketService
  private sseService?: any

  constructor(options: RealtimeOptions = {}) {
    this.pollingInterval = options.pollingInterval || 2000
    this.enableWebSocket = options.enableWebSocket || false
    this.webSocketUrl = options.webSocketUrl
    this.enableSSE = options.enableSSE || false
    this.sseUrl = options.sseUrl

    if (this.enableWebSocket && this.webSocketUrl) {
      this.webSocketService = new WebSocketService(this.webSocketUrl)
      this.webSocketService.connect()
    }
  }

  // Subscribe to messages with multiple fallback strategies
  subscribeToMessages(
    roomId: string | null,
    userId: string | null,
    onMessage: (message: Message) => void
  ): () => void {
    const subscriptionId = `messages-${roomId || userId}`
    
    // Clean up existing subscription
    if (this.activeSubscriptions.has(subscriptionId)) {
      this.activeSubscriptions.get(subscriptionId)?.()
    }

    let unsubscribeFunctions: (() => void)[] = []

    // Strategy 1: Try Supabase real-time subscriptions
    try {
      const channel = supabase
        .channel(subscriptionId)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: roomId 
              ? `room_id=eq.${roomId}`
              : `or(and(sender_id.eq.${userId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${userId}))`
          },
          (payload) => {
            onMessage(payload.new as Message)
          }
        )
        .subscribe()

      unsubscribeFunctions.push(() => channel.unsubscribe())
      console.log('Using Supabase real-time subscriptions')
    } catch (error) {
      console.warn('Supabase real-time failed, trying polling:', error)
    }

    // Strategy 2: Polling fallback
    if (unsubscribeFunctions.length === 0) {
      const pollingUnsubscribe = this.startPolling(roomId, userId, onMessage)
      unsubscribeFunctions.push(pollingUnsubscribe)
      console.log('Using polling fallback')
    }

    // Strategy 3: WebSocket fallback (if enabled)
    if (this.enableWebSocket && this.webSocketService) {
      const wsUnsubscribe = this.webSocketService.subscribe('new_message', (data: any) => {
        if ((roomId && data.room_id === roomId) || (userId && (data.sender_id === userId || data.recipient_id === userId))) {
          onMessage(data)
        }
      })
      unsubscribeFunctions.push(wsUnsubscribe)
    }

    // Strategy 4: Server-Sent Events fallback (if enabled)
    if (this.enableSSE && this.sseUrl) {
      const sseUnsubscribe = this.startSSE(roomId, userId, onMessage)
      unsubscribeFunctions.push(sseUnsubscribe)
    }

    // Create combined unsubscribe function
    const unsubscribe = () => {
      unsubscribeFunctions.forEach(fn => fn())
      this.activeSubscriptions.delete(subscriptionId)
    }

    this.activeSubscriptions.set(subscriptionId, unsubscribe)
    return unsubscribe
  }

  // Enhanced polling with message deduplication
  private startPolling(
    roomId: string | null,
    userId: string | null,
    onMessage: (message: Message) => void
  ): () => void {
    if (!roomId && !userId) return () => {}

    let lastMessageId: string | null = null
    let lastPollTime: number = Date.now()

    const pollInterval = setInterval(async () => {
      try {
        let query = supabase
          .from('messages')
          .select('*')
          .gte('created_at', new Date(lastPollTime).toISOString())
          .order('created_at', { ascending: true })

        if (roomId) {
          query = query.eq('room_id', roomId)
        } else if (userId) {
          query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${userId})`)
        }

        const { data } = await query
        
        if (data && data.length > 0) {
          // Filter out messages we've already seen
          const newMessages = data.filter(msg => {
            if (!lastMessageId) {
              return true // First time, include all messages
            }
            return msg.id !== lastMessageId
          })

          // Update tracking variables
          if (data.length > 0) {
            lastMessageId = data[data.length - 1].id
            lastPollTime = Date.now()
          }

          // Send new messages
          newMessages.forEach(message => {
            onMessage(message)
          })
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, this.pollingInterval)

    return () => clearInterval(pollInterval)
  }

  // Server-Sent Events implementation
  private startSSE(
    roomId: string | null,
    userId: string | null,
    onMessage: (message: Message) => void
  ): () => void {
    if (!this.sseUrl) return () => {}

    const eventSource = new EventSource(`${this.sseUrl}?roomId=${roomId}&userId=${userId}`)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message') {
          onMessage(data.message)
        }
      } catch (error) {
        console.error('SSE parsing error:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
    }

    return () => {
      eventSource.close()
    }
  }

  // Send message through WebSocket (if available)
  sendMessage(message: Message) {
    if (this.webSocketService) {
      this.webSocketService.send('new_message', message)
    }
  }

  // Subscribe to room updates
  subscribeToRooms(onUpdate: () => void): () => void {
    let unsubscribeFunctions: (() => void)[] = []

    // Try Supabase real-time for rooms
    try {
      const channel = supabase
        .channel('rooms-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms'
          },
          () => {
            onUpdate()
          }
        )
        .subscribe()

      unsubscribeFunctions.push(() => channel.unsubscribe())
    } catch (error) {
      console.warn('Room real-time failed, using polling')
      
      // Fallback to polling for rooms
      const pollInterval = setInterval(() => {
        onUpdate()
      }, 5000)

      unsubscribeFunctions.push(() => clearInterval(pollInterval))
    }

    return () => {
      unsubscribeFunctions.forEach(fn => fn())
    }
  }

  // Clean up all subscriptions
  disconnect() {
    this.activeSubscriptions.forEach(unsubscribe => unsubscribe())
    this.activeSubscriptions.clear()
    
    if (this.webSocketService) {
      this.webSocketService.disconnect()
    }
    
    if (this.sseService) {
      this.sseService.close()
    }
  }
}

// Create a singleton instance
export const realtimeService = new RealtimeService({
  pollingInterval: 2000,
  enableWebSocket: false, // Set to true if you have a WebSocket server
  enableSSE: false // Set to true if you have an SSE endpoint
}) 
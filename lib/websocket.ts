// WebSocket service for real-time messaging
export class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Function[]> = new Map()

  constructor(private url: string) {}

  connect() {
    try {
      this.ws = new WebSocket(this.url)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  private handleMessage(data: any) {
    const { type, payload } = data
    
    if (this.listeners.has(type)) {
      this.listeners.get(type)?.forEach(callback => {
        try {
          callback(payload)
        } catch (error) {
          console.error('Error in WebSocket listener:', error)
        }
      })
    }
  }

  subscribe(type: string, callback: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)?.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(type)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

// Create a simple WebSocket server simulation for development
export function createMockWebSocketServer() {
  // This is a mock implementation for development
  // In production, you'd use a real WebSocket server
  
  const mockWs = {
    send: (data: any) => {
      // Simulate message broadcasting
      console.log('Mock WebSocket server received:', data)
    }
  }

  return mockWs
}

// Alternative: Use Server-Sent Events (SSE) for real-time updates
export function createSSEService(url: string) {
  const eventSource = new EventSource(url)
  
  return {
    onMessage: (callback: (data: any) => void) => {
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          callback(data)
        } catch (error) {
          console.error('Error parsing SSE message:', error)
        }
      }
    },
    
    onError: (callback: (error: Event) => void) => {
      eventSource.onerror = callback
    },
    
    close: () => {
      eventSource.close()
    }
  }
} 
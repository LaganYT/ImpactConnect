import { supabase, UserPresence } from './supabase'

export class PresenceService {
  private static instance: PresenceService
  private heartbeatInterval: NodeJS.Timeout | null = null
  private currentUserId: string | null = null
  private currentStatus: 'online' | 'offline' | 'away' | 'busy' = 'online'
  private currentRoomId: string | null = null

  static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService()
    }
    return PresenceService.instance
  }

  // Initialize presence for a user
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId
    
    // Set initial presence
    await this.updatePresence('online')
    
    // Start heartbeat
    this.startHeartbeat()
    
    // Set up page visibility listener
    this.setupVisibilityListener()
    
    // Set up beforeunload listener
    this.setupBeforeUnloadListener()
  }

  // Update user presence
  async updatePresence(
    status: 'online' | 'offline' | 'away' | 'busy',
    roomId?: string
  ): Promise<void> {
    if (!this.currentUserId) return

    this.currentStatus = status
    this.currentRoomId = roomId || null

    try {
      const { error } = await supabase
        .rpc('update_user_presence', {
          p_user_id: this.currentUserId,
          p_status: status,
          p_room_id: roomId || null
        })

      if (error) throw error
    } catch (error) {
      console.error('Error updating presence:', error)
    }
  }

  // Set user as away when page is hidden
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.updatePresence('away')
      } else {
        this.updatePresence('online')
      }
    })
  }

  // Set user as offline when leaving
  private setupBeforeUnloadListener(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('beforeunload', () => {
      this.updatePresence('offline')
    })
  }

  // Start heartbeat to keep presence active
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.currentUserId && this.currentStatus !== 'offline') {
        this.updatePresence(
          this.currentStatus,
          this.currentRoomId === null ? undefined : this.currentRoomId
        )
      }
    }, 30000) // Update every 30 seconds
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // Get user presence
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting user presence:', error)
      return null
    }
  }

  // Get all online users
  async getOnlineUsers(): Promise<UserPresence[]> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('status', 'online')
        .order('last_seen', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting online users:', error)
      return []
    }
  }

  // Get users in a specific room
  async getRoomUsers(roomId: string): Promise<UserPresence[]> {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('room_id', roomId)
        .order('last_seen', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting room users:', error)
      return []
    }
  }

  // Clean up presence when user disconnects
  async disconnect(): Promise<void> {
    if (this.currentUserId) {
      await this.updatePresence('offline')
    }
    
    this.stopHeartbeat()
    this.currentUserId = null
    this.currentStatus = 'offline'
    this.currentRoomId = null
  }

  // Set busy status (e.g., when typing)
  async setBusy(): Promise<void> {
    await this.updatePresence('busy', this.currentRoomId ?? undefined)
  }

  // Set away status
  async setAway(): Promise<void> {
    await this.updatePresence('away', this.currentRoomId ?? undefined)
  }

  // Set online status
  async setOnline(): Promise<void> {
    await this.updatePresence('online', this.currentRoomId ?? undefined)
  }

  // Join a room
  async joinRoom(roomId: string): Promise<void> {
    this.currentRoomId = roomId
    await this.updatePresence(this.currentStatus, roomId)
  }

  // Leave a room
  async leaveRoom(): Promise<void> {
    this.currentRoomId = null
    await this.updatePresence(this.currentStatus)
  }
} 
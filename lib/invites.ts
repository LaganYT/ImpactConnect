import { supabase, RoomInvite, Room } from './supabase'

export class InviteService {
  // Generate a unique invite code
  private static generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Create a new invite for a room
  static async createInvite(
    roomId: string,
    createdBy: string,
    options: {
      maxUses?: number
      expiresAt?: Date
    } = {}
  ): Promise<RoomInvite | null> {
    try {
      // Use the database function to create invite
      const { data, error } = await supabase
        .rpc('create_room_invite', {
          p_room_id: roomId,
          p_created_by: createdBy,
          p_max_uses: options.maxUses,
          p_expires_at: options.expiresAt?.toISOString()
        })

      if (error) {
        console.error('Database function error:', error)
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error creating invite:', error)
      return null
    }
  }

  // Get invite by code
  static async getInvite(code: string): Promise<RoomInvite | null> {
    try {
      console.log('Fetching invite with code:', code)
      
      const { data, error } = await supabase
        .from('room_invites')
        .select('*')
        .eq('code', code)
        .single()

      if (error) {
        console.error('Database error fetching invite:', error)
        throw error
      }
      
      console.log('Invite data:', data)
      return data
    } catch (error) {
      console.error('Error getting invite:', error)
      return null
    }
  }

  // Use an invite (join room)
  static async useInvite(
    inviteCode: string,
    userId: string
  ): Promise<{ success: boolean; roomId?: string; error?: string }> {
    try {
      // Use the database function to use invite
      const { data, error } = await supabase
        .rpc('use_room_invite', {
          p_invite_code: inviteCode,
          p_user_id: userId
        })

      if (error) {
        console.error('Database function error:', error)
        return { success: false, error: 'Failed to join room' }
      }

      return data
    } catch (error) {
      console.error('Error using invite:', error)
      return { success: false, error: 'Failed to join room' }
    }
  }

  // Get all invites for a room
  static async getRoomInvites(roomId: string): Promise<RoomInvite[]> {
    try {
      const { data, error } = await supabase
        .from('room_invites')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting room invites:', error)
      return []
    }
  }

  // Delete an invite
  static async deleteInvite(inviteId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('room_invites')
        .update({ is_active: false })
        .eq('id', inviteId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting invite:', error)
      return false
    }
  }

  // Get invite URL
  static getInviteUrl(code: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/invite/${code}`
  }

  // Extract invite code from URL
  static extractInviteCode(url: string): string | null {
    const match = url.match(/\/invite\/([A-Za-z0-9]+)/)
    return match ? match[1] : null
  }
} 
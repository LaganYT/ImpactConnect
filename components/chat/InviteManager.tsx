'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  Copy, 
  Link, 
  Plus, 
  X, 
  Clock, 
  Users,
  Trash2,
  Settings,
  Check
} from 'lucide-react'
import { InviteService } from '@/lib/invites'
import { RoomInvite } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

interface InviteManagerProps {
  roomId: string
  roomName: string
  onClose: () => void
  onInviteCreated?: (invite: RoomInvite) => void
}

export function InviteManager({ roomId, roomName, onClose, onInviteCreated }: InviteManagerProps) {
  const [invites, setInvites] = useState<RoomInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [newInviteLoading, setNewInviteLoading] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null)

  useEffect(() => {
    fetchInvites()
  }, [roomId])

  const fetchInvites = async () => {
    setLoading(true)
    try {
      const roomInvites = await InviteService.getRoomInvites(roomId)
      setInvites(roomInvites)
    } catch (error) {
      console.error('Error fetching invites:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInvite = async () => {
    setNewInviteLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const invite = await InviteService.createInvite(roomId, user.id, {
        maxUses: undefined, // Unlimited uses (null/undefined means no limit)
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })

      if (invite) {
        setInvites(prev => [invite, ...prev])
        onInviteCreated?.(invite)
      }
    } catch (error) {
      console.error('Error creating invite:', error)
    } finally {
      setNewInviteLoading(false)
    }
  }

  const deleteInvite = async (inviteId: string) => {
    try {
      const success = await InviteService.deleteInvite(inviteId)
      if (success) {
        setInvites(prev => prev.filter(invite => invite.id !== inviteId))
      }
    } catch (error) {
      console.error('Error deleting invite:', error)
    }
  }

  const copyInviteLink = async (code: string) => {
    try {
      const inviteUrl = InviteService.getInviteUrl(code)
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedInvite(code)
      setTimeout(() => setCopiedInvite(null), 2000)
    } catch (error) {
      console.error('Error copying invite link:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const isExpired = (invite: RoomInvite) => {
    if (!invite.expires_at) return false
    return new Date(invite.expires_at) < new Date()
  }

  const isMaxedOut = (invite: RoomInvite) => {
    if (!invite.max_uses) return false
    return invite.used_count >= invite.max_uses
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite People</h2>
            <p className="text-sm text-muted-foreground">Invite people to {roomName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Create New Invite */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-foreground mb-2">Create Invite Link</h3>
              <p className="text-xs text-muted-foreground">
                Create a link that others can use to join this room
              </p>
            </div>
            <Button
              onClick={createInvite}
              disabled={newInviteLoading}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {newInviteLoading ? 'Creating...' : 'Create Invite'}
            </Button>
          </div>
        </div>

        {/* Invites List */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-medium text-foreground mb-4">Active Invites</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading invites...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8">
              <Link className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active invites</p>
              <p className="text-xs text-muted-foreground mt-2">
                Create an invite link to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {invite.code}
                      </code>
                      {isExpired(invite) && (
                        <Badge variant="destructive" size="sm">Expired</Badge>
                      )}
                      {isMaxedOut(invite) && (
                        <Badge variant="secondary" size="sm">Max Uses</Badge>
                      )}
                      {!invite.is_active && (
                        <Badge variant="outline" size="sm">Inactive</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{invite.used_count} uses</span>
                      </div>
                      {invite.max_uses && (
                        <div className="flex items-center gap-1">
                          <span>Max: {invite.max_uses}</span>
                        </div>
                      )}
                      {invite.expires_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Expires: {formatDate(invite.expires_at)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span>Created: {formatDate(invite.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip content="Copy invite link">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyInviteLink(invite.code)}
                        className="w-8 h-8"
                      >
                        {copiedInvite === invite.code ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </Tooltip>
                    
                    <Tooltip content="Delete invite">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteInvite(invite.id)}
                        className="w-8 h-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Invite links expire after 7 days</span>
            <span>{invites.length} active invite{invites.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 
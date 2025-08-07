'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { 
  Hash, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  Shield
} from 'lucide-react'
import { InviteService } from '@/lib/invites'
import { supabase, Room, RoomInvite } from '@/lib/supabase'
import { formatTime } from '@/lib/utils'

interface InvitePageProps {
  params: Promise<{
    code: string
  }>
}

export default function InvitePage({ params }: InvitePageProps) {
  const { code } = use(params)
  const [invite, setInvite] = useState<RoomInvite | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuthAndLoadInvite()
  }, [code])

  const checkAuthAndLoadInvite = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await (supabase.auth as any).getUser()
      setCurrentUser(user)

      // Load invite details
      const inviteData = await InviteService.getInvite(code)
      if (!inviteData) {
        setError('Invalid or expired invite link')
        setLoading(false)
        return
      }

      setInvite(inviteData)

      // Load room details
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', inviteData.room_id)
        .single()

      if (roomData) {
        setRoom(roomData)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading invite:', error)
      setError('Failed to load invite details')
      setLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!currentUser) {
      // Redirect to login with return URL
      router.push(`/?redirect=/invite/${code}`)
      return
    }

    setJoining(true)
    try {
      const result = await InviteService.useInvite(code, currentUser.id)
      
      if (result.success) {
        // Redirect to the room
        router.push(`/?room=${result.roomId}`)
      } else {
        setError(result.error || 'Failed to join room')
      }
    } catch (error) {
      console.error('Error joining room:', error)
      setError('Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  const isExpired = invite && invite.expires_at && new Date(invite.expires_at) < new Date()
  const isMaxedOut = invite && invite.max_uses && invite.used_count >= invite.max_uses
  const isInvalid = !invite || !invite.is_active || isExpired || isMaxedOut

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    )
  }

  if (error || isInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invite</h1>
            <p className="text-muted-foreground mb-6">
              {error || 'This invite link is no longer valid'}
            </p>
            <Button onClick={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-background rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center mx-auto mb-4">
            <Hash className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You're invited!</h1>
          <p className="text-muted-foreground">
            Join the conversation in this room
          </p>
        </div>

        {/* Room Info */}
        <div className="bg-muted rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              fallback={room?.name || 'Room'}
              size="lg"
              className="bg-gradient-to-br from-primary to-primary-hover"
            />
            <div className="flex-1 text-left">
              <h2 className="font-semibold text-foreground">{room?.name}</h2>
              <p className="text-sm text-muted-foreground">
                {room?.description || 'No description'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{invite?.used_count || 0} members</span>
            </div>
            {invite?.max_uses && (
              <div className="flex items-center gap-1">
                <span>Max: {invite.max_uses}</span>
              </div>
            )}
            {invite?.expires_at && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Expires {formatTime(invite.expires_at, true)}</span>
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        {currentUser && (
          <div className="bg-muted rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <Avatar
                fallback={currentUser.email}
                size="md"
              />
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{currentUser.email}</p>
                <p className="text-sm text-muted-foreground">You'll join as a member</p>
              </div>
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
          </div>
        )}

        {/* Join Button */}
        <div className="space-y-3">
          {currentUser ? (
            <Button
              onClick={handleJoinRoom}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                  Joining...
                </>
              ) : (
                <>
                  Join Room
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={async () => router.push(`/?redirect=/invite/${(await params).code}`)}
              className="w-full flex items-center justify-center gap-2"
            >
              Sign In to Join
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="w-full"
          >
            Cancel
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>This invite was created by a room admin</span>
          </div>
        </div>
      </div>
    </div>
  )
} 
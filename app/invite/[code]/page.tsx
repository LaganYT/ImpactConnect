'use client'

import { useState, useEffect, use, useRef } from 'react'
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
  const [code, setCode] = useState<string | null>(null)
  const [invite, setInvite] = useState<RoomInvite | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [progress, setProgress] = useState<string>('Initializing...')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Resolve params first
  useEffect(() => {
    console.log('Params useEffect triggered')
    const resolveParams = async () => {
      try {
        console.log('Resolving params...')
        const resolvedParams = await params
        console.log('Params resolved:', resolvedParams)
        setCode(resolvedParams.code)
      } catch (error) {
        console.error('Error resolving params:', error)
        setError('Invalid invite URL')
        setLoading(false)
      }
    }
    
    resolveParams()
  }, [params])

  // Load invite data once code is available
  useEffect(() => {
    console.log('Code useEffect triggered, code:', code)
    if (!code) {
      console.log('No code available yet, returning')
      return
    }
    
    console.log('Starting invite loading process...')
    
    // Add timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.error('Loading timeout - invite page took too long to load')
        setError('Loading timeout - please try again')
        setLoading(false)
      }
    }, 5000) // 5 second timeout
    
    checkAuthAndLoadInvite()
    
    return () => {
      console.log('Cleaning up timeout')
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [code]) // Removed loading from dependencies to prevent infinite loop

  const checkAuthAndLoadInvite = async () => {
    console.log('=== checkAuthAndLoadInvite START ===')
    console.log('Function called with code:', code)
    
    if (!code) {
      console.log('No code provided, returning early')
      return
    }
    
    try {
      console.log('Starting invite loading process for code:', code)
      setLoading(true)
      setError(null)
      setProgress('Starting...')

      // Test mode for debugging
      if (code === 'test') {
        console.log('Running in test mode')
        setProgress('Loading test data...')
        setInvite({
          id: 'test-invite-id',
          room_id: 'test-room-id',
          code: 'test',
          created_by: 'test-user',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          max_uses: 10,
          used_count: 0,
          is_active: true
        })
        setRoom({
          id: 'test-room-id',
          name: 'Test Room',
          description: 'This is a test room for debugging',
          is_private: false,
          created_by: 'test-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        setProgress('Complete')
        
        // Clear the timeout since data loaded successfully
        if (timeoutRef.current) {
          console.log('Clearing timeout - test mode data loaded successfully')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }

      // Simple test mode - no async operations
      if (code === 'simple') {
        console.log('Running in simple test mode - no async operations')
        setProgress('Loading simple test data...')
        
        // Use setTimeout to simulate async but avoid real async operations
        setTimeout(() => {
          setInvite({
            id: 'simple-invite-id',
            room_id: 'simple-room-id',
            code: 'simple',
            created_by: 'simple-user',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            max_uses: 10,
            used_count: 0,
            is_active: true
          })
          setRoom({
            id: 'simple-room-id',
            name: 'Simple Test Room',
            description: 'This is a simple test room (no async operations)',
            is_private: false,
            created_by: 'simple-user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          setProgress('Complete')
          setLoading(false)
        }, 100)
        return
      }

      // Immediate test mode - completely synchronous
      if (code === 'immediate') {
        console.log('Running in immediate test mode - completely synchronous')
        setProgress('Loading immediate test data...')
        
        // Set data immediately without any async operations
        setInvite({
          id: 'immediate-invite-id',
          room_id: 'immediate-room-id',
          code: 'immediate',
          created_by: 'immediate-user',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          max_uses: 10,
          used_count: 0,
          is_active: true
        })
        setRoom({
          id: 'immediate-room-id',
          name: 'Immediate Test Room',
          description: 'This is an immediate test room (completely synchronous)',
          is_private: false,
          created_by: 'immediate-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        setProgress('Complete')
        setLoading(false)
        return
      }

      setProgress('Checking configuration...')
      console.log('Step 1: Checking Supabase configuration...')
      // Check if Supabase is properly configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('Supabase URL:', supabaseUrl)
      console.log('Supabase Key exists:', !!supabaseKey)
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl === 'https://placeholder.supabase.co' || 
          supabaseKey === 'placeholder-key') {
        console.error('Supabase not configured properly')
        setError('Supabase is not properly configured. Please check your environment variables.')
        
        // Clear the timeout on error
        if (timeoutRef.current) {
          console.log('Clearing timeout - Supabase not configured')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }

      // Check if Supabase client is properly initialized
      console.log('Checking Supabase client...')
      if (!supabase || typeof supabase.auth === 'undefined') {
        console.error('Supabase client not properly initialized')
        setError('Database client not properly initialized')
        
        // Clear the timeout on error
        if (timeoutRef.current) {
          console.log('Clearing timeout - Supabase client not initialized')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }
      console.log('Supabase client is properly initialized')

      setProgress('Testing database connection...')
      console.log('Step 1.5: Testing database connectivity...')
      // Test database connectivity with a simple query
      try {
        const { data: testData, error: testError } = await supabase
          .from('room_invites')
          .select('count')
          .limit(1)
        
        if (testError) {
          console.error('Database connectivity test failed:', testError)
          setError('Unable to connect to database. Please check your Supabase configuration.')
          
          // Clear the timeout on error
          if (timeoutRef.current) {
            console.log('Clearing timeout - database connectivity test failed')
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          
          setLoading(false)
          return
        }
        console.log('Database connectivity test passed')
      } catch (error) {
        console.error('Database connectivity test failed:', error)
        setError('Unable to connect to database. Please check your Supabase configuration.')
        
        // Clear the timeout on error
        if (timeoutRef.current) {
          console.log('Clearing timeout - database connectivity test failed')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }

      setProgress('Checking authentication...')
      console.log('Step 2: Checking user authentication...')
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        // Don't fail on auth error, just continue without user
      } else {
        console.log('User authenticated:', !!user)
      }
      
      setCurrentUser(user)

      setProgress('Loading invite details...')
      console.log('Step 3: Loading invite details...')
      // Load invite details with retry
      let inviteData = null
      let retries = 3
      
      while (retries > 0 && !inviteData) {
        try {
          console.log(`Attempting to fetch invite (attempt ${4 - retries}/3)...`)
          inviteData = await InviteService.getInvite(code)
          if (inviteData) {
            console.log('Invite data loaded successfully:', inviteData)
            break
          }
        } catch (error) {
          console.error(`Invite fetch attempt ${4 - retries} failed:`, error)
          retries--
          if (retries > 0) {
            console.log(`Retrying in 1 second... (${retries} attempts left)`)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
          }
        }
      }
      
      if (!inviteData) {
        console.error('Failed to load invite data after all retries')
        setError('Invalid or expired invite link')
        
        // Clear the timeout on error
        if (timeoutRef.current) {
          console.log('Clearing timeout - failed to load invite data')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }

      setInvite(inviteData)

      setProgress('Loading room details...')
      console.log('Step 4: Loading room details...')
      // Load room details with retry
      let roomData = null
      retries = 3
      
      while (retries > 0 && !roomData) {
        try {
          console.log(`Attempting to fetch room (attempt ${4 - retries}/3)...`)
          const { data, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', inviteData.room_id)
            .single()

          if (roomError) {
            console.error('Error loading room:', roomError)
            throw roomError
          }

          roomData = data
          if (roomData) {
            console.log('Room data loaded successfully:', roomData)
            break
          }
        } catch (error) {
          console.error(`Room fetch attempt ${4 - retries} failed:`, error)
          retries--
          if (retries > 0) {
            console.log(`Retrying in 1 second... (${retries} attempts left)`)
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
          }
        }
      }

      if (roomData) {
        setRoom(roomData)
      } else {
        console.error('Failed to load room data after all retries')
        setError('Failed to load room details')
        
        // Clear the timeout on error
        if (timeoutRef.current) {
          console.log('Clearing timeout - failed to load room data')
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        
        setLoading(false)
        return
      }

      setProgress('Complete')
      console.log('All data loaded successfully, setting loading to false')
      
      // Clear the timeout since data loaded successfully
      if (timeoutRef.current) {
        console.log('Clearing timeout - data loaded successfully')
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Unexpected error in checkAuthAndLoadInvite:', error)
      setError('Failed to load invite details')
      
      // Clear the timeout on error as well
      if (timeoutRef.current) {
        console.log('Clearing timeout - error occurred')
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
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
      const result = await InviteService.useInvite(code!, currentUser.id)
      
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
  const isMaxedOut = invite && invite.max_uses !== null && invite.max_uses !== undefined && invite.max_uses > 0 && invite.used_count >= invite.max_uses
  const isInvalid = !invite || !invite.is_active || isExpired || isMaxedOut

  // Debug validation logic
  console.log('=== VALIDATION DEBUG ===')
  console.log('invite:', invite)
  console.log('invite?.is_active:', invite?.is_active)
  console.log('invite?.max_uses:', invite?.max_uses)
  console.log('invite?.used_count:', invite?.used_count)
  console.log('isExpired:', isExpired)
  console.log('isMaxedOut:', isMaxedOut)
  console.log('isInvalid:', isInvalid)
  console.log('error:', error)
  console.log('=======================')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2">Loading invite...</p>
          <p className="text-sm text-muted-foreground">{progress}</p>
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
              onClick={() => router.push(`/?redirect=/invite/${code}`)}
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
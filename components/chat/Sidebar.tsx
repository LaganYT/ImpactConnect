'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { realtimeService } from '@/lib/realtime'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { ContextMenu } from '@/components/ui/ContextMenu'

import { 
  MessageSquare, 
  Users, 
  Search, 
  LogOut,
  Settings,
  User,
  Hash,
  Crown
} from 'lucide-react'
import { Room, User as UserType } from '@/lib/supabase'

interface SidebarProps {
  selectedRoom: string | null
  onRoomSelect: (roomId: string) => void
  onDirectMessageSelect: (userId: string) => void
}

export function Sidebar({ selectedRoom, onRoomSelect, onDirectMessageSelect }: SidebarProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [currentUser, setCurrentUser] = useState<UserType | null>(null)
  const [searchTerm, setSearchTerm] = useState('')


  useEffect(() => {
    const initializeData = async () => {
      await fetchCurrentUser()
      await fetchRooms()
      await fetchUsers()
    }
    initializeData()
  }, [])

  // Refetch rooms when currentUser changes
  useEffect(() => {
    if (currentUser) {
      fetchRooms()
    }
  }, [currentUser])

  // Set up real-time subscription for rooms with fallback
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToRooms(() => {
      fetchRooms()
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await (supabase.auth as any).getUser()
    if (user) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      setCurrentUser(data)
    }
  }

  const fetchRooms = async () => {
    if (!currentUser) return
    
    // First get the room IDs that the user is a member of
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', currentUser.id)

    if (memberships && memberships.length > 0) {
      const roomIds = memberships.map(m => m.room_id)
      
      // Then get the full room details
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds)
        .order('created_at', { ascending: false })

      setRooms(roomsData || [])
    } else {
      setRooms([])
    }
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .neq('id', currentUser?.id || '')
      .order('full_name', { ascending: true })

    setUsers(data || [])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
                  <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">ImpactConnect</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Real-time messaging</p>
            </div>
          </div>
        
        <div className="relative">
          <Input
            placeholder="Search rooms and users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Rooms Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Rooms
            </h2>
          </div>

          <div className="space-y-1">
            {filteredRooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No rooms found</p>
                {searchTerm && <p className="text-xs mt-1">Try adjusting your search</p>}
              </div>
            ) : (
              filteredRooms.map((room) => (
                <ContextMenu
                  key={room.id}
                  items={[
                    {
                      label: 'Open Room',
                      icon: <Hash className="w-4 h-4" />,
                      onClick: () => onRoomSelect(room.id)
                    },
                    {
                      label: 'Copy Room ID',
                      icon: <Hash className="w-4 h-4" />,
                      onClick: () => navigator.clipboard.writeText(room.id)
                    }
                  ]}
                >
                  <button
                    onClick={() => onRoomSelect(room.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                      selectedRoom === room.id 
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selectedRoom === room.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${
                          selectedRoom === room.id 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {room.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {room.description || 'No description'}
                        </p>
                      </div>
                      {room.created_by === currentUser?.id && (
                        <Crown className="w-3 h-3 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </button>
                </ContextMenu>
              ))
            )}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Direct Messages
            </h2>
          </div>
          
          <div className="space-y-1">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No users found</p>
                {searchTerm && <p className="text-xs mt-1">Try adjusting your search</p>}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <ContextMenu
                  key={user.id}
                  items={[
                    {
                      label: 'Send Message',
                      icon: <MessageSquare className="w-4 h-4" />,
                      onClick: () => onDirectMessageSelect(user.id)
                    },
                    {
                      label: 'Copy User ID',
                      icon: <User className="w-4 h-4" />,
                      onClick: () => navigator.clipboard.writeText(user.id)
                    }
                  ]}
                >
                  <button
                    onClick={() => onDirectMessageSelect(user.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.full_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  </button>
                </ContextMenu>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Profile */}
      {currentUser && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
              {currentUser.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentUser.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentUser.email}
              </p>
            </div>
            
            <Tooltip content="Sign out">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      )}


    </div>
  )
} 
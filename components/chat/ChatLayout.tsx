'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'
import { ChatArea } from './ChatArea'
import { User } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function ChatLayout() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        setCurrentUser(data)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoom(roomId)
    setSelectedUser(null)
  }

  const handleDirectMessageSelect = (userId: string) => {
    setSelectedUser(userId)
    setSelectedRoom(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your chat...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Authentication Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Unable to load your user profile. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar
        selectedRoom={selectedRoom}
        onRoomSelect={handleRoomSelect}
        onDirectMessageSelect={handleDirectMessageSelect}
      />
      <ChatArea
        selectedRoom={selectedRoom}
        selectedUser={selectedUser}
        currentUser={currentUser}
      />
    </div>
  )
} 
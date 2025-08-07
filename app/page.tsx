'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { ChatLayout } from '@/components/chat/ChatLayout'
import { SetupGuide } from '@/components/SetupGuide'
import { AuthForm } from '@/components/auth/AuthForm'
import { DebugInfo } from '@/components/DebugInfo'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabaseConfigured, setSupabaseConfigured] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check for redirect parameter in URL
    const urlParams = new URLSearchParams(window.location.search)
    const redirect = urlParams.get('redirect')
    const room = urlParams.get('room')
    
    if (redirect) {
      setRedirectAfterAuth(redirect)
    }
    
    // Handle room parameter for direct room access
    if (room && user) {
      // Clear the room parameter from URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('room')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [user])

  useEffect(() => {
    // Check if Supabase is properly configured
    const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co'
    
    console.log('Supabase configured:', isConfigured)
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    
    if (!isConfigured) {
      setSupabaseConfigured(false)
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('Initial session:', session?.user?.email)
        console.log('Session error:', error)
        console.log('Full session data:', session)
        
        if (session?.user) {
          console.log('Setting user from initial session:', session.user.email)
          setUser(session.user)
        } else {
          console.log('No user in initial session')
          setUser(null)
        }
        setLoading(false)
      } catch (error) {
        console.error('Error getting initial session:', error)
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event)
      console.log('Auth state change session:', session?.user?.email)
      console.log('Full session data:', session)
      
      if (session?.user) {
        console.log('Setting user from auth state change:', session.user.email)
        setUser(session.user)
        
        // Handle redirect after successful authentication
        if (redirectAfterAuth && event === 'SIGNED_IN') {
          router.push(redirectAfterAuth)
          setRedirectAfterAuth(null)
        }
      } else {
        console.log('Clearing user from auth state change')
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Debug mode - press Ctrl+D to show debug info
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        setShowDebug(!showDebug)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDebug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading your chat...</p>
        </div>
      </div>
    )
  }

  if (!supabaseConfigured) {
    return <SetupGuide />
  }

  if (showDebug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <DebugInfo />
      </div>
    )
  }

  console.log('Current user state:', user?.email)
  console.log('Current loading state:', loading)

  if (!user) {
    console.log('No user found, showing AuthForm')
    return <AuthForm />
  }

  console.log('User authenticated, showing ChatLayout:', user.email)
  return <ChatLayout />
}

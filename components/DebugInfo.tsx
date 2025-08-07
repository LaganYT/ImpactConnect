'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function DebugInfo() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState<string>('')

  const checkSession = async () => {
    try {
      console.log('Manually checking session...')
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('Manual session check result:', { session, error })
      setSession(session)
      setUser(session?.user)
      setLastCheck(new Date().toLocaleTimeString())
    } catch (err) {
      console.error('Error checking session:', err)
    }
  }

  useEffect(() => {
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Debug - Auth state change:', event, session)
      setSession(session)
      setUser(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const clearStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
      console.log('Storage cleared')
      checkSession()
    }
  }

  if (loading) {
    return <div>Loading debug info...</div>
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Environment Variables:</h3>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set'}</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set'}</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Session:</h3>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <pre>{JSON.stringify(session, null, 2)}</pre>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">User:</h3>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <pre>{JSON.stringify(user, null, 2)}</pre>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Local Storage:</h3>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm">
            <p>impactconnect-auth: {typeof window !== 'undefined' ? localStorage.getItem('impactconnect-auth') || 'Not found' : 'Not available'}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkSession} variant="outline">
            Check Session
          </Button>
          <Button onClick={signOut} variant="outline">
            Sign Out
          </Button>
          <Button onClick={clearStorage} variant="outline">
            Clear Storage
          </Button>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>

        {lastCheck && (
          <p className="text-sm text-gray-500">Last session check: {lastCheck}</p>
        )}
      </CardContent>
    </Card>
  )
} 
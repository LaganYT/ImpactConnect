'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { emailToUsername } from '@/lib/usernames'
import styles from '@/components/settings.module.css'

export default function SettingsPanel() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAuth, setSavingAuth] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const normalizeUsername = (raw: string): string => {
    const trimmed = (raw || '').trim()
    if (!trimmed) return ''
    const withAt = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
    return withAt.toLowerCase()
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setMessage(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Prefer existing auth info immediately
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; user_name?: string }
      const displayFromMeta = meta.full_name || meta.name || meta.user_name || ''
      const computedUsername = emailToUsername(user.email) || ''

      setEmail(user.email ?? '')
      setFullName(displayFromMeta)
      setUsername('')

      // Try loading profile row
      const { data: profile } = await supabase
        .from('users')
        .select('username, full_name, email')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        setUsername(profile.username || computedUsername)
        setFullName(profile.full_name || displayFromMeta)
        setEmail(profile.email || user.email || '')
      } else {
        // No profile row present yet
        setUsername(computedUsername)
      }

      setLoading(false)
    }
    load()
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setError(null)
    setMessage(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingProfile(false)
      return
    }

    const nextUsername = normalizeUsername(username)
    if (!nextUsername) {
      setError('Username cannot be empty')
      setSavingProfile(false)
      return
    }

    const { error: upErr } = await supabase
      .from('users')
      .update({ full_name: fullName, username: nextUsername })
      .eq('id', user.id)

    if (upErr) {
      const msg = upErr.message?.toLowerCase() || ''
      const code = (upErr as { code?: string })?.code
      if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists') || msg.includes('unique')) {
        setError('That username is already taken. Please choose another.')
      } else {
        setError(upErr.message)
      }
    } else {
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      setMessage('Profile updated')
      setUsername(nextUsername)
    }
    setSavingProfile(false)
  }

  const saveAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAuth(true)
    setError(null)
    setMessage(null)

    try {
      if (email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email })
        if (emailErr) throw emailErr
      }
      if (newPassword) {
        const { error: passErr } = await supabase.auth.updateUser({ password: newPassword })
        if (passErr) throw passErr
      }
      setMessage('Auth settings updated. You may need to verify your email.')
      setNewPassword('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update auth settings'
      setError(message)
    } finally {
      setSavingAuth(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.card}>Loading settings…</div>
    )
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Account Settings</h1>

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={saveProfile} className={styles.form}>
        <h2 className={styles.section}>Profile</h2>
        <label className={styles.label}>Display name</label>
        <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />

        <label className={styles.label}>Username</label>
        <input className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@yourname" />

        <button type="submit" className={styles.primary} disabled={savingProfile}>
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form onSubmit={saveAuth} className={styles.form}>
        <h2 className={styles.section}>Login</h2>
        <label className={styles.label}>Email</label>
        <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

        <label className={styles.label}>New password</label>
        <input className={styles.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />

        <button type="submit" className={styles.primary} disabled={savingAuth}>
          {savingAuth ? 'Saving…' : 'Update login'}
        </button>
      </form>
    </div>
  )
}


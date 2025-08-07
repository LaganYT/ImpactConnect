'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import styles from './verify-email.module.css'

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get email from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search)
    const emailParam = urlParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [])

  const handleResendEmail = async () => {
    if (!email) {
      setMessage('Please enter your email address')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Verification email sent! Please check your inbox.')
    }
    setLoading(false)
  }

  const handleBackToLogin = () => {
    router.push('/auth/login')
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>📧</div>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          We&apos;ve sent a verification link to your email address.
        </p>

        <div className={styles.emailInput}>
          <label htmlFor="email" className={styles.label}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="Enter your email"
          />
        </div>

        {message && (
          <div className={message.includes('error') ? styles.error : styles.success}>
            {message}
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={handleResendEmail}
            disabled={loading}
            className={styles.resendButton}
          >
            {loading ? 'Sending...' : 'Resend verification email'}
          </button>
          <button
            onClick={handleBackToLogin}
            className={styles.backButton}
          >
            Back to login
          </button>
        </div>

        <p className={styles.help}>
          Didn&apos;t receive the email? Check your spam folder or try a different email address.
        </p>
      </div>
    </div>
  )
} 
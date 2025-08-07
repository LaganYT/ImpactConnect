'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { ChatSession } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import { emailToUsername } from '@/lib/usernames'
import styles from './Sidebar.module.css'
import Link from 'next/link'

interface SidebarProps {
  user: User
  chatSessions: ChatSession[]
  selectedChat: ChatSession | null
  onLogout: () => void
}

export default function Sidebar({
  user,
  chatSessions,
  selectedChat,
  onLogout
}: SidebarProps) {
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatUsername, setNewChatUsername] = useState('')
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleNewDM = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Normalize username input (ensure it starts with @)
      const username = newChatUsername.trim().startsWith('@')
        ? newChatUsername.trim()
        : `@${newChatUsername.trim()}`

      // Resolve user id by username via RPC (bypasses RLS)
      const { data: resolvedUserId, error: resolveError } = await supabase
        .rpc('resolve_user_by_username', { p_username: username })

      if (resolveError || !resolvedUserId) {
        alert('User not found')
        return
      }

      if (resolvedUserId === user.id) {
        alert('You cannot create a DM with yourself')
        return
      }

      // Check if DM already exists
      const { data: existingDM } = await supabase
        .from('direct_messages')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${resolvedUserId}),and(user1_id.eq.${resolvedUserId},user2_id.eq.${user.id})`)
        .single()

      if (existingDM) {
        alert('Direct message already exists')
        return
      }

      // Create new DM
      const { data: newDM, error: dmError } = await supabase
        .from('direct_messages')
        .insert({
          user1_id: user.id,
          user2_id: resolvedUserId
        })
        .select()
        .single()

      if (dmError) throw dmError

      // Refresh chat sessions
      window.location.reload()
    } catch (error) {
      console.error('Error creating DM:', error)
      alert('Failed to create direct message')
    } finally {
      setLoading(false)
      setShowNewChat(false)
      setNewChatUsername('')
    }
  }

  const handleNewRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Use RPC to create room and add creator as admin in one transaction
      const { data: roomId, error: rpcError } = await supabase
        .rpc('create_room_with_owner', {
          p_name: newRoomName,
          p_description: newRoomDescription,
          p_is_private: true,
        })

      if (rpcError) throw rpcError

      // Refresh chat sessions
      window.location.reload()
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Failed to create room')
    } finally {
      setLoading(false)
      setShowNewRoom(false)
      setNewRoomName('')
      setNewRoomDescription('')
    }
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U'}
          </div>
          <div className={styles.userDetails}>
            <h3 className={styles.userName}>
              {user.user_metadata?.full_name || 'User'}
            </h3>
            <p className={styles.userEmail}>{user.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className={styles.logoutButton}>
          Logout
        </button>
      </div>

      <div className={styles.actions}>
        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className={styles.newChatButton}
        >
          New DM
        </button>
        <button
          onClick={() => setShowNewRoom(!showNewRoom)}
          className={styles.newRoomButton}
        >
          New Room
        </button>
      </div>

      {showNewChat && (
        <form onSubmit={handleNewDM} className={styles.newChatForm}>
          <input
            type="text"
            value={newChatUsername}
            onChange={(e) => setNewChatUsername(e.target.value)}
            placeholder="Enter username (e.g. @logan)"
            className={styles.input}
            required
          />
          <div className={styles.formActions}>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Creating...' : 'Create DM'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewChat(false)}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showNewRoom && (
        <form onSubmit={handleNewRoom} className={styles.newRoomForm}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Room name"
            className={styles.input}
            required
          />
          <textarea
            value={newRoomDescription}
            onChange={(e) => setNewRoomDescription(e.target.value)}
            placeholder="Room description (optional)"
            className={styles.textarea}
            rows={3}
          />
          <div className={styles.formActions}>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewRoom(false)}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={styles.chatList}>
        <h3 className={styles.sectionTitle}>Direct Messages</h3>
        {chatSessions
          .filter(chat => chat.type === 'dm')
          .map(chat => (
            <Link
              key={chat.id}
              className={`${styles.chatItem} ${
                selectedChat?.id === chat.id ? styles.selected : ''
              }`}
              href={`/chat/${chat.id}`}
            >
              <div className={styles.chatAvatar}>
                {chat.name[0]}
              </div>
              <div className={styles.chatInfo}>
                <h4 className={styles.chatName}>{chat.name}</h4>
                {chat.unread_count > 0 && (
                  <span className={styles.unreadBadge}>{chat.unread_count}</span>
                )}
              </div>
            </Link>
          ))}

        <h3 className={styles.sectionTitle}>Rooms</h3>
        {chatSessions
          .filter(chat => chat.type === 'room')
          .map(chat => (
            <Link
              key={chat.id}
              className={`${styles.chatItem} ${
                selectedChat?.id === chat.id ? styles.selected : ''
              }`}
              href={`/chat/${chat.id}`}
            >
              <div className={styles.roomAvatar}>
                #
              </div>
              <div className={styles.chatInfo}>
                <h4 className={styles.chatName}>{chat.name}</h4>
                {chat.unread_count > 0 && (
                  <span className={styles.unreadBadge}>{chat.unread_count}</span>
                )}
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
} 
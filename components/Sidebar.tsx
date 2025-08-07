'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { ChatSession } from '@/lib/types'
import { createClient } from '@/lib/supabase'
import styles from './Sidebar.module.css'

interface SidebarProps {
  user: User
  chatSessions: ChatSession[]
  selectedChat: ChatSession | null
  onSelectChat: (chat: ChatSession) => void
  onLogout: () => void
}

export default function Sidebar({
  user,
  chatSessions,
  selectedChat,
  onSelectChat,
  onLogout
}: SidebarProps) {
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatEmail, setNewChatEmail] = useState('')
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDescription, setNewRoomDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleNewDM = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Find user by email
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('email', newChatEmail)
        .single()

      if (userError || !targetUser) {
        alert('User not found')
        return
      }

      if (targetUser.id === user.id) {
        alert('You cannot create a DM with yourself')
        return
      }

      // Check if DM already exists
      const { data: existingDM } = await supabase
        .from('direct_messages')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${user.id})`)
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
          user2_id: targetUser.id
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
      setNewChatEmail('')
    }
  }

  const handleNewRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Generate id client-side to avoid SELECT after INSERT (blocked by RLS)
      const roomId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) // fallback (not UUID)

      // Create new room (no select to avoid RLS RETURNING)
      const { error: roomError } = await supabase
        .from('rooms')
        .insert({
          id: roomId,
          name: newRoomName,
          description: newRoomDescription,
          created_by: user.id,
          is_private: true,
          invite_code: Math.random().toString(36).substring(2, 8).toUpperCase()
        })

      if (roomError) throw roomError

      // Add creator as admin member (requires RLS policy for creator)
      const { error: memberError } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: user.id,
          role: 'admin'
        })

      if (memberError) throw memberError

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
            type="email"
            value={newChatEmail}
            onChange={(e) => setNewChatEmail(e.target.value)}
            placeholder="Enter user email"
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
            <div
              key={chat.id}
              className={`${styles.chatItem} ${
                selectedChat?.id === chat.id ? styles.selected : ''
              }`}
              onClick={() => onSelectChat(chat)}
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
            </div>
          ))}

        <h3 className={styles.sectionTitle}>Rooms</h3>
        {chatSessions
          .filter(chat => chat.type === 'room')
          .map(chat => (
            <div
              key={chat.id}
              className={`${styles.chatItem} ${
                selectedChat?.id === chat.id ? styles.selected : ''
              }`}
              onClick={() => onSelectChat(chat)}
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
            </div>
          ))}
      </div>
    </div>
  )
} 
"use client";

import { useEffect, useState } from "react";
import { BannedUser } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import styles from "./BannedUsersModal.module.css";

interface BannedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export default function BannedUsersModal({
  isOpen,
  onClose,
  roomId,
}: BannedUsersModalProps) {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [unbanLoading, setUnbanLoading] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && roomId) {
      fetchBannedUsers();
    }
  }, [isOpen, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBannedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("banned_users")
        .select(`
          *,
          user:users(id, username, email, full_name, avatar_url),
          banned_by_user:users!banned_users_banned_by_fkey(id, username, email, full_name)
        `)
        .eq("room_id", roomId)
        .order("banned_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      setBannedUsers(data || []);
    } catch (error) {
      console.error("Failed to fetch banned users:", error);
      // Show a more user-friendly error message
      alert("Failed to load banned users. Please check if you have admin permissions and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userId: string) => {
    setUnbanLoading(userId);
    try {
      const { error } = await supabase.rpc("unban_user_from_room", {
        p_room_id: roomId,
        p_user_id: userId,
      });

      if (error) throw error;
      
      // Remove from local state
      setBannedUsers(prev => prev.filter(bu => bu.user_id !== userId));
    } catch (error) {
      console.error("Failed to unban user:", error);
      alert("Failed to unban user. Please try again.");
    } finally {
      setUnbanLoading(null);
    }
  };

  const getDisplayName = (user: { full_name?: string | null; username?: string | null; email?: string | null } | null | undefined) => {
    if (!user) return "Unknown User";
    return user.full_name || user.username || user.email?.split("@")[0] || "Unknown";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Banned Users</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner} />
              <p>Loading banned users...</p>
            </div>
          ) : bannedUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🚫</div>
              <p>No banned users</p>
            </div>
          ) : (
            <div className={styles.bannedList}>
              {bannedUsers.map((bannedUser) => (
                <div key={bannedUser.id} className={styles.bannedItem}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      {bannedUser.user?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bannedUser.user.avatar_url}
                          alt="Avatar"
                          className={styles.avatarImage}
                        />
                      ) : (
                        <span className={styles.avatarInitial}>
                          {getDisplayName(bannedUser.user)[0]?.toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div className={styles.userDetails}>
                      <div className={styles.userName}>
                        {getDisplayName(bannedUser.user)}
                      </div>
                      <div className={styles.banInfo}>
                        <span className={styles.bannedBy}>
                          Banned by {getDisplayName(bannedUser.banned_by_user)}
                        </span>
                        <span className={styles.banDate}>
                          {formatDate(bannedUser.banned_at)}
                        </span>
                      </div>
                      {bannedUser.reason && (
                        <div className={styles.banReason}>
                          Reason: {bannedUser.reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className={styles.unbanButton}
                    onClick={() => handleUnban(bannedUser.user_id)}
                    disabled={unbanLoading === bannedUser.user_id}
                  >
                    {unbanLoading === bannedUser.user_id ? "Unbanning..." : "Unban"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

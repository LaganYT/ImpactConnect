"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import styles from "./AdminContextMenu.module.css";

interface AdminContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetUser: {
    user_id: string;
    users?: {
      id: string;
      username?: string | null;
      email?: string | null;
      full_name?: string | null;
    } | null;
  } | null;
  roomId: string;
  onClose: () => void;
  onAction: () => void;
}

export default function AdminContextMenu({
  isOpen,
  position,
  targetUser,
  roomId,
  onClose,
  onAction,
}: AdminContextMenuProps) {
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleKick = async () => {
    if (!targetUser) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("kick_user_from_room", {
        p_room_id: roomId,
        p_user_id: targetUser.user_id,
      });

      if (error) throw error;
      
      onAction();
      onClose();
    } catch (error) {
      console.error("Failed to kick user:", error);
      alert("Failed to kick user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBan = async () => {
    if (!targetUser) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("ban_user_from_room", {
        p_room_id: roomId,
        p_user_id: targetUser.user_id,
        p_reason: banReason || null,
      });

      if (error) throw error;
      
      onAction();
      onClose();
      setShowBanModal(false);
      setBanReason("");
    } catch (error) {
      console.error("Failed to ban user:", error);
      alert("Failed to ban user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayName = () => {
    if (!targetUser?.users) return targetUser?.user_id.slice(0, 8) || "Unknown";
    const { full_name, username, email } = targetUser.users;
    return full_name || username || email?.split("@")[0] || "Unknown";
  };

  if (!isOpen || !targetUser) return null;

  return (
    <>
      <div
        ref={menuRef}
        className={styles.contextMenu}
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className={styles.menuHeader}>
          <span className={styles.targetName}>{getDisplayName()}</span>
        </div>
        
        <div className={styles.menuItems}>
          <button
            className={`${styles.menuItem} ${styles.kickButton}`}
            onClick={handleKick}
            disabled={isLoading}
          >
            <span className={styles.icon}>👢</span>
            Kick User
          </button>
          
          <button
            className={`${styles.menuItem} ${styles.banButton}`}
            onClick={() => setShowBanModal(true)}
            disabled={isLoading}
          >
            <span className={styles.icon}>🚫</span>
            Ban User
          </button>
        </div>
      </div>

      {showBanModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Ban {getDisplayName()}</h3>
            <p>This user will be removed from the room and prevented from rejoining.</p>
            
            <div className={styles.inputGroup}>
              <label htmlFor="banReason">Reason (optional):</label>
              <textarea
                id="banReason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter a reason for the ban..."
                rows={3}
                className={styles.textarea}
              />
            </div>
            
            <div className={styles.modalActions}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason("");
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className={`${styles.confirmButton} ${styles.banButton}`}
                onClick={handleBan}
                disabled={isLoading}
              >
                {isLoading ? "Banning..." : "Ban User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
        </div>
      </div>


    </>
  );
}

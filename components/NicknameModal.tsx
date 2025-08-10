"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { emailToUsername } from "@/lib/usernames";
import Modal from "./Modal";

interface NicknameModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: User;
  targetUser: {
    id: string;
    username?: string | null;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  currentNickname?: string;
}

export default function NicknameModal({
  open,
  onClose,
  currentUser,
  targetUser,
  currentNickname,
}: NicknameModalProps) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      setNickname(currentNickname || "");
    }
  }, [open, currentNickname]);

  const getDisplayName = () => {
    if (targetUser.id === currentUser.id) {
      const full = (currentUser.user_metadata as { full_name?: string })?.full_name || null;
      const email = currentUser.email || null;
      const uname = email ? emailToUsername(email) : null;
      return full || uname || "You";
    }
    const full = targetUser.full_name || null;
    const uname = targetUser.username || (targetUser.email ? emailToUsername(targetUser.email) : null) || null;
    if (full && uname) return `${full} (${uname})`;
    return full || uname || targetUser.id.slice(0, 8);
  };

  const handleSave = async () => {
    if (targetUser.id === currentUser.id) return; // Can't nickname yourself
    setSaving(true);
    try {
      const trimmed = nickname.trim();
      if (!trimmed) {
        // Remove nickname
        await supabase
          .from("user_nicknames")
          .delete()
          .eq("owner_user_id", currentUser.id)
          .eq("target_user_id", targetUser.id);
      } else {
        // Set/update nickname
        await supabase
          .from("user_nicknames")
          .upsert(
            {
              owner_user_id: currentUser.id,
              target_user_id: targetUser.id,
              nickname: trimmed,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "owner_user_id,target_user_id",
            },
          );
      }
      onClose();
    } catch (e) {
      console.error("Failed to set nickname", e);
      alert("Failed to set nickname");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (targetUser.id === currentUser.id) return;
    setSaving(true);
    try {
      await supabase
        .from("user_nicknames")
        .delete()
        .eq("owner_user_id", currentUser.id)
        .eq("target_user_id", targetUser.id);
      onClose();
    } catch (e) {
      console.error("Failed to remove nickname", e);
      alert("Failed to remove nickname");
    } finally {
      setSaving(false);
    }
  };

  if (targetUser.id === currentUser.id) {
    return (
      <Modal open={open} title="Nickname" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <p>You cannot set a nickname for yourself.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="Set Nickname" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {targetUser.avatar_url ? (
              <img
                src={targetUser.avatar_url}
                alt="Avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              getDisplayName()[0]?.toUpperCase() || "U"
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{getDisplayName()}</div>
            {currentNickname && (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Current nickname: {currentNickname}
              </div>
            )}
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
            Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter a nickname..."
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: 14,
              backgroundColor: "var(--color-background)",
              color: "var(--color-text)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) {
                void handleSave();
              }
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {currentNickname && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                backgroundColor: "transparent",
                color: "var(--color-text)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              backgroundColor: "transparent",
              color: "var(--color-text)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "white",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

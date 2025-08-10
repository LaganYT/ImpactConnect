"use client";

import { useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ChatSession } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { emailToUsername } from "@/lib/usernames";
// Reuse the same styles as the room members sidebar for consistent UI
import styles from "./RoomMembersSidebar.module.css";
import NicknameModal from "./NicknameModal";

interface DMMembersSidebarProps {
  user: User;
  selectedChat: ChatSession | null;
}

type ParticipantRow = {
  user_id: string;
  users?: {
    id: string;
    username?: string | null;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

export default function DMMembersSidebar({
  user,
  selectedChat,
}: DMMembersSidebarProps) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [nicknameModal, setNicknameModal] = useState<{
    open: boolean;
    targetUser: ParticipantRow | null;
  }>({ open: false, targetUser: null });
  const supabase = createClient();

  const dmId = selectedChat?.type === "dm" ? selectedChat.id : null;

  useEffect(() => {
    if (!dmId) return;
    fetchParticipants();
    const channel = supabase
      .channel(`dm_nicknames:${dmId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_nicknames",
          filter: `owner_user_id=eq.${user.id}`,
        },
        () => fetchParticipants(),
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId]);

  const fetchParticipants = async () => {
    if (!dmId) return;
    setLoading(true);
    try {
      const { data: dmRow, error: dmError } = await supabase
        .from("direct_messages")
        .select("user1_id, user2_id")
        .eq("id", dmId)
        .maybeSingle();

      if (dmError || !dmRow) {
        setParticipants([]);
        return;
      }

      const ids = [dmRow.user1_id as string, dmRow.user2_id as string];
      const { data: profiles, error: profilesError } = await supabase
        .from("users")
        .select("id, username, email, full_name, avatar_url")
        .in("id", ids);

      if (profilesError) throw profilesError;

      const idToProfile: Record<string, {
        id: string;
        username?: string | null;
        email?: string | null;
        full_name?: string | null;
        avatar_url?: string | null;
      } | undefined> = {};
      for (const p of (profiles || [])) {
        idToProfile[p.id] = p as unknown as {
          id: string;
          username?: string | null;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
      }

      const rows: ParticipantRow[] = ids.map((uid) => ({
        user_id: uid,
        users: idToProfile[uid] || { id: uid },
      }));

      setParticipants(rows);
      // Fetch universal nicknames for the current user
      try {
        const { data: nicks } = await supabase
          .from("user_nicknames")
          .select("target_user_id, nickname")
          .eq("owner_user_id", user.id);
        const map: Record<string, string> = {};
        (nicks || []).forEach((n: { target_user_id: string; nickname: string }) => {
          map[n.target_user_id] = n.nickname;
        });
        setNicknameMap(map);
      } catch {}
    } catch (err) {
      console.error("Failed to fetch DM participants", err);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedParticipants = useMemo(() => {
    const list = [...participants];
    // Keep current user first, then partner alphabetically
    list.sort((a, b) => {
      if (a.user_id === user.id && b.user_id !== user.id) return -1;
      if (b.user_id === user.id && a.user_id !== user.id) return 1;
      const an = getDisplayNameWithNick(a, user, nicknameMap);
      const bn = getDisplayNameWithNick(b, user, nicknameMap);
      return an.localeCompare(bn);
    });
    return list;
  }, [participants, user, nicknameMap]);

  if (!dmId) return null;

  return (
    <aside className={styles.rightbar} aria-label="DM participants">
      <div className={styles.header}>
        <h3 className={styles.title}>Members</h3>
        <span className={styles.count}>{participants.length}</span>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>Loading members...</p>
        </div>
      ) : (
        <div className={styles.membersList}>
          {sortedParticipants.map((m) => (
            <div key={m.user_id} className={styles.memberItem}>
              <div className={styles.avatar}>
                {(() => {
                  const avatarUrl =
                    m.user_id === user.id
                      ? (user.user_metadata as { avatar_url?: string })?.avatar_url || null
                      : m.users?.avatar_url || null;
                  if (avatarUrl) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    );
                  }
                  return getDisplayInitial(m, user);
                })()}
              </div>
              <div className={styles.memberInfo}>
                <div className={styles.nameRow}>
                  <span className={styles.name} title={getOriginalNameTooltip(m, user)}>
                    {getDisplayNameWithNick(m, user, nicknameMap)}
                  </span>
                  {m.user_id === user.id && (
                    <span className={styles.youBadge}>You</span>
                  )}
                </div>
                {m.user_id !== user.id && (
                  <div className={styles.metaRow}>
                    <button
                      type="button"
                      className={`${styles.nicknameButton} ${nicknameMap[m.user_id] ? styles.hasNickname : ""}`}
                      onClick={() => setNicknameModal({ open: true, targetUser: m })}
                      title={nicknameMap[m.user_id] ? "Edit nickname" : "Set nickname"}
                    >
                      {nicknameMap[m.user_id] ? "Edit" : "Nick"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {nicknameModal.open && nicknameModal.targetUser && (
        <NicknameModal
          open={nicknameModal.open}
          onClose={() => setNicknameModal({ open: false, targetUser: null })}
          currentUser={user}
          targetUser={{
            id: nicknameModal.targetUser.user_id,
            username: nicknameModal.targetUser.users?.username,
            email: nicknameModal.targetUser.users?.email,
            full_name: nicknameModal.targetUser.users?.full_name,
            avatar_url: nicknameModal.targetUser.users?.avatar_url,
          }}
          currentNickname={nicknameMap[nicknameModal.targetUser.user_id]}
        />
      )}
    </aside>
  );
}

function getDisplayName(m: ParticipantRow, currentUser: User): string {
  if (m.user_id === currentUser.id) {
    const full = (currentUser.user_metadata as { full_name?: string })?.full_name || null;
    const email = currentUser.email || null;
    const uname = email ? emailToUsername(email) : null;
    return full || uname || "You";
  }
  const full = m.users?.full_name || null;
  const uname =
    m.users?.username ||
    (m.users?.email ? emailToUsername(m.users.email) : null) ||
    null;
  if (full && uname) return `${full} (${uname})`;
  return full || uname || m.user_id.slice(0, 8);
}

function getDisplayInitial(m: ParticipantRow, currentUser: User): string {
  if (m.user_id === currentUser.id) {
    return (
      (currentUser.user_metadata as { full_name?: string })?.full_name?.[0] ||
      currentUser.email?.[0] ||
      "U"
    );
  }
  const full = m.users?.full_name || null;
  const email = m.users?.email || null;
  return full?.[0] || email?.[0] || "U";
}

function getDisplayNameWithNick(m: ParticipantRow, currentUser: User, map: Record<string, string>): string {
  if (m.user_id === currentUser.id) return getDisplayName(m, currentUser);
  const nick = map[m.user_id];
  if (nick) return nick;
  return getDisplayName(m, currentUser);
}

function getOriginalNameTooltip(m: ParticipantRow, currentUser: User): string | undefined {
  const base = getDisplayName(m, currentUser);
  return base ? `Original: ${base}` : undefined;
}



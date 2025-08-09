"use client";

import { useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ChatSession } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { emailToUsername } from "@/lib/usernames";
import styles from "./RoomMembersSidebar.module.css";

interface RoomMembersSidebarProps {
  user: User;
  selectedChat: ChatSession | null;
}

type MemberRow = {
  user_id: string;
  role: "admin" | "member";
  users?: {
    id: string;
    username?: string | null;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type ListRoomMemberRow = {
  user_id: string;
  role: "admin" | "member";
  username: string | null;
  email: string | null;
  full_name: string | null;
};

export default function RoomMembersSidebar({
  user,
  selectedChat,
}: RoomMembersSidebarProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [nicknameMap, setNicknameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const roomId = selectedChat?.type === "room" ? selectedChat.id : null;

  useEffect(() => {
    if (!roomId) return;
    fetchMembers();
    const cleanup = subscribeRealtime(roomId);
    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const fetchMembers = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      // Prefer RPC that bypasses users RLS safely
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "list_room_members_with_profiles",
        { p_room_id: roomId },
      );

      if (!rpcError && Array.isArray(rpcData)) {
        // Map basic fields first
        let rows: MemberRow[] = (rpcData as ListRoomMemberRow[]).map((r) => ({
          user_id: r.user_id,
          role: r.role,
          users: {
            id: r.user_id,
            username: r.username,
            email: r.email,
            full_name: r.full_name,
          },
        }));

        // Try to enrich with avatar_url via direct select (RLS should allow for room members)
        try {
          const ids = rows.map((r) => r.user_id);
          const { data: avatars } = await supabase
            .from("users")
            .select("id, avatar_url")
            .in("id", ids);
          if (Array.isArray(avatars)) {
            const idToAvatar: Record<string, string | null> = {};
            for (const a of avatars as {
              id: string;
              avatar_url: string | null;
            }[]) {
              idToAvatar[a.id] = a.avatar_url;
            }
            rows = rows.map((r) => ({
              ...r,
              users: {
                ...(r.users || { id: r.user_id }),
                avatar_url: idToAvatar[r.user_id] ?? null,
              },
            }));
          }
        } catch {}

        setMembers(rows);
        // Also fetch nicknames for this room scoped to the current user
        try {
          const { data: nicks } = await supabase
            .from("user_nicknames")
            .select("target_user_id, nickname")
            .eq("owner_user_id", user.id)
            .eq("room_id", roomId);
          const map: Record<string, string> = {};
          (nicks || []).forEach((n: { target_user_id: string; nickname: string }) => {
            map[n.target_user_id] = n.nickname;
          });
          setNicknameMap(map);
        } catch {}
        return;
      }

      // Fallback: direct select with join alias
      const { data, error } = await supabase
        .from("room_members")
        .select(
          "user_id, role, users:users(id, username, email, full_name, avatar_url)",
        )
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });

      if (error) throw error;
      const typed = (data || []) as unknown as {
        user_id: string;
        role: "admin" | "member";
        users: {
          id: string;
          username: string | null;
          email: string | null;
          full_name: string | null;
          avatar_url?: string | null;
        };
      }[];
      setMembers(typed);
      // Fetch nicknames for this room
      try {
        const { data: nicks } = await supabase
          .from("user_nicknames")
          .select("target_user_id, nickname")
          .eq("owner_user_id", user.id)
          .eq("room_id", roomId);
        const map: Record<string, string> = {};
        (nicks || []).forEach((n: { target_user_id: string; nickname: string }) => {
          map[n.target_user_id] = n.nickname;
        });
        setNicknameMap(map);
      } catch {}
    } catch (err) {
      console.error("Failed to fetch room members", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeRealtime = (rid: string) => {
    const channel = supabase
      .channel(`room_members:${rid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${rid}`,
        },
        () => {
          fetchMembers();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_nicknames",
          filter: `room_id=eq.${rid}`,
        },
        () => fetchMembers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sortedMembers = useMemo(() => {
    const list = [...members];
    list.sort((a, b) => {
      // Admins first, then alphabetically by display name
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      const an = getDisplayNameWithNick(a, user, nicknameMap);
      const bn = getDisplayNameWithNick(b, user, nicknameMap);
      return an.localeCompare(bn);
    });
    return list;
  }, [members, user, nicknameMap]);

  if (!roomId) return null;

  return (
    <aside className={styles.rightbar} aria-label="Room members">
      <div className={styles.header}>
        <h3 className={styles.title}>Members</h3>
        <span className={styles.count}>{members.length}</span>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p>Loading members...</p>
        </div>
      ) : (
        <div className={styles.membersList}>
          {sortedMembers.map((m) => (
            <div key={m.user_id} className={styles.memberItem}>
              <div className={styles.avatar}>
                {(() => {
                  const avatarUrl =
                    m.user_id === user.id
                      ? (user.user_metadata as { avatar_url?: string })
                          ?.avatar_url || null
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
                <div className={styles.metaRow}>
                  <span
                    className={`${styles.roleBadge} ${m.role === "admin" ? styles.admin : ""}`}
                  >
                    {m.role}
                  </span>
                  {m.user_id !== user.id && (
                    <button
                      type="button"
                      className={styles.editCancel}
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        const current = nicknameMap[m.user_id] || "";
                        const next = window.prompt("Set nickname", current || "");
                        if (next === null) return;
                        const trimmed = next.trim();
                        try {
                          if (!trimmed) {
                            await supabase
                              .from("user_nicknames")
                              .delete()
                              .eq("owner_user_id", user.id)
                              .eq("room_id", roomId)
                              .eq("target_user_id", m.user_id);
                          } else {
                            await supabase
                              .from("user_nicknames")
                              .upsert(
                                {
                                  owner_user_id: user.id,
                                  room_id: roomId,
                                  direct_message_id: null,
                                  target_user_id: m.user_id,
                                  nickname: trimmed,
                                  updated_at: new Date().toISOString(),
                                },
                                {
                                  onConflict:
                                    "owner_user_id,target_user_id,room_id,direct_message_id",
                                },
                              );
                          }
                          await fetchMembers();
                        } catch (e) {
                          console.error("Failed to set nickname", e);
                          alert("Failed to set nickname");
                        }
                      }}
                      title={nicknameMap[m.user_id] ? "Edit nickname" : "Set nickname"}
                    >
                      {nicknameMap[m.user_id] ? "Edit" : "Nick"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sortedMembers.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <p>No members yet</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function getDisplayName(m: MemberRow, currentUser: User): string {
  if (m.user_id === currentUser.id) {
    const full =
      (currentUser.user_metadata as { full_name?: string })?.full_name || null;
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

function getDisplayInitial(m: MemberRow, currentUser: User): string {
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

function getDisplayNameWithNick(m: MemberRow, currentUser: User, map: Record<string, string>): string {
  if (m.user_id === currentUser.id) return getDisplayName(m, currentUser);
  const nick = map[m.user_id];
  if (nick) return nick;
  return getDisplayName(m, currentUser);
}

function getOriginalNameTooltip(m: MemberRow, currentUser: User): string | undefined {
  const base = getDisplayName(m, currentUser);
  return base ? `Original: ${base}` : undefined;
}

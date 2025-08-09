"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import SettingsPanel from "./SettingsPanel";
import RoomMembersSidebar from "./RoomMembersSidebar";
import Modal from "./Modal";
import { ChatSession, Room } from "@/lib/types";
import { emailToUsername } from "@/lib/usernames";
import styles from "./ChatLayout.module.css";

interface ChatLayoutProps {
  user: User;
  selectedChatId?: string;
}

export default function ChatLayout({ user, selectedChatId }: ChatLayoutProps) {
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const supabase = createClient();

  // Track window focus/visibility to avoid noisy notifications
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] =
    useState<boolean>(false);

  // Refs to avoid stale closures in realtime callbacks
  const selectedChatRef = useRef<ChatSession | null>(null);
  const chatSessionsRef = useRef<ChatSession[]>([]);
  const isWindowFocusedRef = useRef<boolean>(true);
  const isTabVisibleRef = useRef<boolean>(true);
  const userIdRef = useRef<string>(user.id);

  useEffect(() => {
    fetchChatSessions();
    const cleanup = setupRealtimeSubscriptions();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  // Keep refs in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);

  useEffect(() => {
    isWindowFocusedRef.current = isWindowFocused;
  }, [isWindowFocused]);

  useEffect(() => {
    isTabVisibleRef.current = isTabVisible;
  }, [isTabVisible]);

  // When user selects/opens a chat, clear its unread counter
  useEffect(() => {
    if (!selectedChat) return;
    setChatSessions((prev) => {
      const current = prev.find((s) => s.id === selectedChat.id);
      if (!current || (current.unread_count || 0) === 0) return prev;
      return prev.map((s) =>
        s.id === selectedChat.id ? { ...s, unread_count: 0 } : s,
      );
    });
  }, [selectedChat]);

  // Track window focus and request notifications
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    const handleVisibilityChange = () => {
      try {
        setIsTabVisible(document.visibilityState === "visible");
      } catch {}
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initialize visibility on mount
    try {
      setIsTabVisible(document.visibilityState === "visible");
    } catch {}

    // Initialize notification permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        setHasNotificationPermission(Notification.permission === "granted");
        if (Notification.permission === "default") {
          Notification.requestPermission()
            .then((perm) => {
              setHasNotificationPermission(perm === "granted");
            })
            .catch(() => {});
        }
      } catch {}
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Sync selection from selectedChatId when sessions load or id changes
  useEffect(() => {
    if (!selectedChatId) return;
    if (chatSessions.length === 0) return;
    const found = chatSessions.find((c) => c.id === selectedChatId);
    if (!found) return;
    if (found.id !== selectedChat?.id) {
      setSelectedChat(found);
    }
  }, [selectedChatId, chatSessions, selectedChat?.id]);

  const fetchChatSessions = async () => {
    try {
      // Fetch direct messages (no joins to avoid RLS issues)
      const { data: dms, error: dmError } = await supabase
        .from("direct_messages")
        .select(`id, user1_id, user2_id, created_at, updated_at`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (dmError) throw dmError;

      // Fetch rooms directly; RLS should filter to only rooms the user can see
      const { data: rooms, error: roomError } = await supabase
        .from("rooms")
        .select(
          "id, name, description, created_at, updated_at, is_private, invite_code, created_by",
        );

      if (roomError) throw roomError;

      // For DMs: fetch partner usernames and avatar to label and show icon
      const dmSessions: ChatSession[] = [];
      for (const dm of dms || []) {
        const partnerId = dm.user1_id === user.id ? dm.user2_id : dm.user1_id;
        let partnerName = "Unknown";
        let partnerAvatar: string | null = null;
        try {
          const { data: partner } = await supabase
            .from("users")
            .select("username, email, avatar_url")
            .eq("id", partnerId)
            .maybeSingle();
          partnerName =
            partner?.username ||
            (partner?.email
              ? emailToUsername(partner.email) || partner.email
              : "Unknown");
          partnerAvatar = partner?.avatar_url ?? null;
        } catch {}
        dmSessions.push({
          id: dm.id,
          type: "dm",
          name: `DM with ${partnerName}`,
          unread_count: 0,
          avatarUrl: partnerAvatar,
        });
      }

      const roomSessions: ChatSession[] =
        rooms?.map((rm: Room) => ({
          id: rm.id,
          type: "room",
          name: rm.name,
          inviteCode: rm.invite_code,
          unread_count: 0,
          isOwner: rm.created_by === user.id,
        })) || [];

      const allSessions: ChatSession[] = [...dmSessions, ...roomSessions];

      // Compute initial unread counts so refresh doesn't clear badges
      const computeUnreadCount = async (
        session: ChatSession,
      ): Promise<number> => {
        // Count all messages in the chat not sent by the current user
        const totalQuery = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user.id);
        const { count: totalCount } = await (session.type === "dm"
          ? totalQuery.eq("direct_message_id", session.id)
          : totalQuery.eq("room_id", session.id));

        // Count how many of those messages have a read receipt by the current user
        const readQuery = supabase
          .from("message_reads")
          .select("message_id, messages!inner(id)", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id);
        const { count: readCount } = await (session.type === "dm"
          ? readQuery.eq("messages.direct_message_id", session.id)
          : readQuery.eq("messages.room_id", session.id));

        const t = totalCount || 0;
        const r = readCount || 0;
        const unread = t - r;
        return unread > 0 ? unread : 0;
      };

      const unreadCounts = await Promise.all(
        allSessions.map((s) => computeUnreadCount(s)),
      );
      const updatedSessions = allSessions.map((s, idx) => ({
        ...s,
        unread_count: unreadCounts[idx],
      }));
      setChatSessions(updatedSessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to new messages (RLS ensures only messages user can view)
    const messagesSubscription = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const message = payload.new as unknown as {
            id: string;
            content: string;
            sender_id: string;
            sender_name?: string | null;
            sender_username?: string | null;
            room_id?: string | null;
            direct_message_id?: string | null;
          };

          // Ignore messages sent by the current user
          if (!message || message.sender_id === userIdRef.current) return;

          const targetChatId = message.room_id || message.direct_message_id;
          if (!targetChatId) return;

          // Increment unread count if not viewing that chat (or window unfocused)
          const isViewingThisChat =
            selectedChatRef.current?.id === targetChatId;
          const shouldIncrement =
            !isViewingThisChat || !isWindowFocusedRef.current;
          if (shouldIncrement) {
            setChatSessions((prev) =>
              prev.map((s) =>
                s.id === targetChatId
                  ? { ...s, unread_count: (s.unread_count || 0) + 1 }
                  : s,
              ),
            );
          }

          // Only notify if
          // - notification permission granted
          // - window/tab is not focused (avoid noise while actively using the app)
          const permissionOk =
            hasNotificationPermission ||
            (typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted");
          if (!permissionOk) return;

          const shouldNotify =
            !isWindowFocusedRef.current || !isTabVisibleRef.current;
          if (!shouldNotify) return;

          // Find session name for title
          const session = chatSessionsRef.current.find(
            (s) => s.id === targetChatId,
          );
          const title = session ? session.name : "New message";

          const senderLabel =
            message.sender_username || message.sender_name || "Someone";
          const body = `${senderLabel}: ${message.content}`;

          try {
            const notif = new Notification(title, {
              body,
            });
            notif.onclick = () => {
              try {
                window.focus();
              } catch {}
              if (window.location.pathname !== `/chat/${targetChatId}`) {
                window.location.href = `/chat/${targetChatId}`;
              }
              try {
                notif.close();
              } catch {}
            };
          } catch {
            // Silently ignore if notifications fail
          }
        },
      )
      .subscribe();

    // Clear unread badge instantly when reads are recorded for the current user
    const readsSubscription = supabase
      .channel("message_reads_badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reads",
        },
        (payload) => {
          const row = payload.new as unknown as { user_id: string };
          if (!row || row.user_id !== userIdRef.current) return;
          const current = selectedChatRef.current;
          if (!current) return;
          setChatSessions((prev) => {
            const found = prev.find((s) => s.id === current.id);
            if (!found || (found.unread_count || 0) === 0) return prev;
            return prev.map((s) =>
              s.id === current.id ? { ...s, unread_count: 0 } : s,
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
      supabase.removeChannel(readsSubscription);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar
        user={user}
        chatSessions={chatSessions}
        selectedChat={selectedChat}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ChatWindow
          user={user}
          selectedChat={selectedChat}
          onSendMessage={async (content: string) => {
            if (!selectedChat) return;

            // Fetch sender's canonical username from profile
            const { data: profile } = await supabase
              .from("users")
              .select("username")
              .eq("id", user.id)
              .maybeSingle();

            const senderUsername =
              profile?.username || emailToUsername(user.email) || null;

            const { error } = await supabase.from("messages").insert({
              content,
              sender_id: user.id,
              sender_name:
                (user.user_metadata as { full_name?: string })?.full_name ||
                null,
              sender_email: user.email || null,
              sender_username: senderUsername,
              [selectedChat.type === "dm" ? "direct_message_id" : "room_id"]:
                selectedChat.id,
            });

            if (error) {
              console.error("Error sending message:", error);
            }
          }}
        />
        {showSettings && (
          <Modal
            open={showSettings}
            title="Settings"
            onClose={() => setShowSettings(false)}
          >
            <SettingsPanel />
          </Modal>
        )}
      </div>
      <RoomMembersSidebar user={user} selectedChat={selectedChat} />
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { useToastContext } from "./ToastProvider";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import SettingsPanel from "./SettingsPanel";
import RoomMembersSidebar from "./RoomMembersSidebar";
import DMMembersSidebar from "./DMMembersSidebar";
import Modal from "./Modal";
import { ChatSession, Room } from "@/lib/types";
import { emailToUsername } from "@/lib/usernames";
import styles from "./ChatLayout.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface ChatLayoutProps {
  user: User;
  selectedChatId?: string;
}

export default function ChatLayout({ user, selectedChatId }: ChatLayoutProps) {
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const supabase = createClient();
  const toast = useToastContext();
  const searchParams = useSearchParams();

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle ban error from URL parameter
  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "banned") {
      toast.error("You are banned from this room and cannot rejoin.");
      // Remove the error parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, toast]);

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

  // Close mobile menu when chat is selected
  useEffect(() => {
    if (selectedChat) {
      setShowMobileMenu(false);
    }
  }, [selectedChat]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        // Apply universal nickname if present
        let nickname: string | null = null;
        try {
          const { data: nick } = await supabase
            .from("user_nicknames")
            .select("nickname")
            .eq("owner_user_id", user.id)
            .eq("target_user_id", partnerId)
            .maybeSingle();
          nickname = nick?.nickname || null;
          const { data: partner } = await supabase
            .from("users")
            .select("username, email, avatar_url")
            .eq("id", partnerId)
            .maybeSingle();
          partnerName =
            nickname ||
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

          // Find session name for title
          const session = chatSessionsRef.current.find(
            (s) => s.id === targetChatId,
          );
          const title = session ? session.name : "New message";

          const senderLabel =
            message.sender_username || message.sender_name || "Someone";
          const body = `${senderLabel}: ${message.content}`;

          // Show toast notification when focused on tab but not on this conversation
          const isFocusedOnTab = isWindowFocusedRef.current && isTabVisibleRef.current;
          const isFocusedOnThisChat = selectedChatRef.current?.id === targetChatId;
          
          if (isFocusedOnTab && !isFocusedOnThisChat) {
            // Show clickable toast notification for new message in different conversation
            toast.info(
              `${title}: ${body}`, 
              4000, 
              () => {
                // Navigate to the conversation when toast is clicked
                window.location.href = `/chat/${targetChatId}`;
              },
              true // Make it clickable
            );
            return;
          }

          // Show browser notification when tab/window is not focused
          const shouldShowBrowserNotification =
            !isWindowFocusedRef.current || !isTabVisibleRef.current;
          
          if (shouldShowBrowserNotification) {
            // Only notify if notification permission granted
            const permissionOk =
              hasNotificationPermission ||
              (typeof window !== "undefined" &&
                "Notification" in window &&
                Notification.permission === "granted");
            if (!permissionOk) return;

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

  const handleNewDM = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);

    try {
      // Normalize username input (ensure it starts with @)
      const username = newChatUsername.trim().startsWith("@")
        ? newChatUsername.trim()
        : `@${newChatUsername.trim()}`;

      // Resolve user id by username via RPC (bypasses RLS)
      const { data: resolvedUserId, error: resolveError } = await supabase.rpc(
        "resolve_user_by_username",
        { p_username: username },
      );

      if (resolveError || !resolvedUserId) {
        toast.error("User not found");
        return;
      }

      if (resolvedUserId === user.id) {
        toast.error("You cannot create a DM with yourself");
        return;
      }

      // Check if DM already exists
      const { data: existingDM } = await supabase
        .from("direct_messages")
        .select("id")
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${resolvedUserId}),and(user1_id.eq.${resolvedUserId},user2_id.eq.${user.id})`,
        )
        .single();

      if (existingDM) {
        toast.error("Direct message already exists");
        return;
      }

      // Create new DM
      const { error: dmError } = await supabase
        .from("direct_messages")
        .insert({
          user1_id: user.id,
          user2_id: resolvedUserId,
        })
        .select()
        .single();

      if (dmError) {
        console.error("Error creating DM:", dmError);
        toast.error("Failed to create direct message");
        return;
      }

      toast.success("Direct message created successfully");
      setNewChatUsername("");
      setShowNewChat(false);
      setShowMobileMenu(false);
      // Refresh chat sessions
      await fetchChatSessions();
    } catch (error) {
      console.error("Error creating DM:", error);
      toast.error("Failed to create direct message");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);

    try {
      const { error: roomError } = await supabase
        .from("rooms")
        .insert({
          name: newRoomName.trim(),
          description: newRoomDescription.trim() || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (roomError) {
        console.error("Error creating room:", roomError);
        toast.error("Failed to create room");
        return;
      }

      toast.success("Room created successfully");
      setNewRoomName("");
      setNewRoomDescription("");
      setShowNewRoom(false);
      setShowMobileMenu(false);
      // Refresh chat sessions
      await fetchChatSessions();
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
    } finally {
      setLoadingAction(false);
    }
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
      {/* Mobile menu button */}
      <button
        className={styles.mobileMenuButton}
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        aria-label="Toggle menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>

      {/* Mobile Top Bar */}
      <div className={styles.mobileTopBar}>
        <div className={styles.mobileTopBarContent}>
          <div className={styles.mobileTopBarInfo}>
            <h2 className={styles.mobileTopBarTitle}>
              {selectedChat?.name || "Select a chat"}
            </h2>
            <p className={styles.mobileTopBarSubtitle}>
              {selectedChat?.type === "dm" ? "Direct Message" : selectedChat?.type === "room" ? "Room" : ""}
            </p>
          </div>
          {selectedChat?.type === "room" && selectedChat?.inviteCode && (
            <button
              className={styles.mobileTopBarInviteButton}
              onClick={async () => {
                const url = `${window.location.origin}/invite/${selectedChat.inviteCode}`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Invite link copied to clipboard");
                } catch {
                  // Fallback for browsers that don't support clipboard API
                  const textArea = document.createElement("textarea");
                  textArea.value = url;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textArea);
                  toast.success("Invite link copied to clipboard");
                }
              }}
              title="Copy invite link"
              aria-label="Copy invite link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Invite
            </button>
          )}
        </div>
      </div>

      {/* Full Screen Mobile Menu */}
      {showMobileMenu && (
        <div className={styles.fullScreenMobileMenu}>
          <div className={styles.mobileMenuHeader}>
            <div className={styles.mobileMenuUserInfo}>
              <div className={styles.mobileMenuAvatar}>
                {(() => {
                  if (user.user_metadata?.avatar_url) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.user_metadata.avatar_url}
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
                  return (
                    user.user_metadata?.full_name?.[0] || user.email?.[0] || "U"
                  );
                })()}
              </div>
              <div className={styles.mobileMenuUserDetails}>
                <h3 className={styles.mobileMenuUserName}>
                  {user.user_metadata?.full_name || "User"}
                </h3>
                <p className={styles.mobileMenuUserEmail}>{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => setShowMobileMenu(false)}
              className={styles.mobileMenuCloseButton}
              title="Close menu"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className={styles.mobileMenuContent}>
            <div className={styles.mobileMenuActions}>
              <button
                onClick={() => setShowNewChat(true)}
                className={styles.mobileMenuActionButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
                </svg>
                New DM
              </button>
              <button
                onClick={() => setShowNewRoom(true)}
                className={styles.mobileMenuActionButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                New Room
              </button>
            </div>

            <div className={styles.mobileMenuSections}>
              <div className={styles.mobileMenuSection}>
                <h3 className={styles.mobileMenuSectionTitle}>Direct Messages</h3>
                <div className={styles.mobileMenuChatList}>
                  {chatSessions
                    .filter((chat) => chat.type === "dm")
                    .map((chat) => (
                      <Link
                        key={chat.id}
                        className={`${styles.mobileMenuChatItem} ${
                          selectedChat?.id === chat.id ? styles.mobileMenuSelected : ""
                        }`}
                        href={`/chat/${chat.id}`}
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <div className={styles.mobileMenuChatAvatar}>
                          {chat.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={chat.avatarUrl}
                              alt="Avatar"
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            chat.name?.replace(/^DM with\s+/i, "")?.trim()?.[0] ||
                            chat.name?.[0] ||
                            "U"
                          )}
                        </div>
                        <div className={styles.mobileMenuChatInfo}>
                          <h4 className={styles.mobileMenuChatName}>{chat.name}</h4>
                          {chat.unread_count > 0 && (
                            <span className={styles.mobileMenuUnreadBadge}>
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>

              <div className={styles.mobileMenuSection}>
                <h3 className={styles.mobileMenuSectionTitle}>Rooms</h3>
                <div className={styles.mobileMenuChatList}>
                  {chatSessions
                    .filter((chat) => chat.type === "room")
                    .map((chat) => (
                      <Link
                        key={chat.id}
                        className={`${styles.mobileMenuChatItem} ${
                          selectedChat?.id === chat.id ? styles.mobileMenuSelected : ""
                        }`}
                        href={`/chat/${chat.id}`}
                        onClick={() => setShowMobileMenu(false)}
                      >
                        <div className={styles.mobileMenuRoomAvatar}>#</div>
                        <div className={styles.mobileMenuChatInfo}>
                          <h4 className={styles.mobileMenuChatName}>{chat.name}</h4>
                          {chat.unread_count > 0 && (
                            <span className={styles.mobileMenuUnreadBadge}>
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            </div>

            <div className={styles.mobileMenuFooter}>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setShowMobileMenu(false);
                }}
                className={styles.mobileMenuFooterButton}
                title="Settings"
                aria-label="Settings"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.66,1H10.34a.5.5,0,0,0-.49.41L9.47,4.06a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.41h3.32a.5.5,0,0,0,.49-.41l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
                </svg>
                Settings
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setShowMobileMenu(false);
                }}
                className={styles.mobileMenuFooterButton}
                title="Logout"
                aria-label="Logout"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 17l1.41-1.41L8.83 13H21v-2H8.83l2.58-2.59L10 7l-5 5 5 5z" />
                  <path d="M3 19h6v2H1V3h8v2H3z" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New DM Form Modal */}
      {showNewChat && (
        <div className={styles.mobileModalOverlay}>
          <div className={styles.mobileModal}>
            <div className={styles.mobileModalHeader}>
              <h3>New Direct Message</h3>
              <button
                onClick={() => setShowNewChat(false)}
                className={styles.mobileModalCloseButton}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleNewDM} className={styles.mobileModalForm}>
              <input
                type="text"
                value={newChatUsername}
                onChange={(e) => setNewChatUsername(e.target.value)}
                placeholder="Enter username (e.g. @example)"
                className={styles.mobileModalInput}
                required
              />
              <div className={styles.mobileModalActions}>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className={styles.mobileModalSubmitButton}
                >
                  {loadingAction ? "Creating..." : "Create DM"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewChat(false)}
                  className={styles.mobileModalCancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Room Form Modal */}
      {showNewRoom && (
        <div className={styles.mobileModalOverlay}>
          <div className={styles.mobileModal}>
            <div className={styles.mobileModalHeader}>
              <h3>New Room</h3>
              <button
                onClick={() => setShowNewRoom(false)}
                className={styles.mobileModalCloseButton}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleNewRoom} className={styles.mobileModalForm}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className={styles.mobileModalInput}
                required
              />
              <textarea
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="Room description (optional)"
                className={styles.mobileModalTextarea}
                rows={3}
              />
              <div className={styles.mobileModalActions}>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className={styles.mobileModalSubmitButton}
                >
                  {loadingAction ? "Creating..." : "Create Room"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewRoom(false)}
                  className={styles.mobileModalCancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`${styles.sidebarContainer} ${showMobileMenu ? styles.sidebarOpen : ''}`}>
        <Sidebar
          user={user}
          chatSessions={chatSessions}
          selectedChat={selectedChat}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>
      
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

            // If content is an ImpactStream URL, resolve to vidsrc embed URL first
            const impactMatch = content.match(
              /^https?:\/\/(?:www\.)?impactstream\.vercel\.app\/(movie|tv)\/\d+/i,
            );
            let finalContent = content;
            if (impactMatch) {
              try {
                const res = await fetch(
                  `/api/impactstream/resolve?url=${encodeURIComponent(content)}`,
                  { cache: "no-store" },
                );
                const json = (await res
                  .json()
                  .catch(() => null)) as { ok?: boolean; embedUrl?: string } | null;
                if (res.ok && json?.ok && json.embedUrl) {
                  finalContent = json.embedUrl;
                }
              } catch {
                // ignore resolver errors; send original content
              }
            }

            const senderUsername =
              profile?.username || emailToUsername(user.email) || null;

            const { error } = await supabase.from("messages").insert({
              content: finalContent,
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
      <div className={styles.membersSidebarContainer}>
        {selectedChat?.type === "room" ? (
          <RoomMembersSidebar user={user} selectedChat={selectedChat} />
        ) : (
          <DMMembersSidebar user={user} selectedChat={selectedChat} />
        )}
      </div>
    </div>
  );
}

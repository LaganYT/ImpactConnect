"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSpoiler from "@/lib/markdownSpoiler";
import dynamic from "next/dynamic";
import { User, type RealtimeChannel } from "@supabase/supabase-js";
import { ChatSession, Message } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { emailToUsername } from "@/lib/usernames";
import styles from "./ChatWindow.module.css";

// Lazy-load emoji picker on the client
const EmojiPicker = dynamic(
  () => import("emoji-picker-react").then((mod) => mod.default),
  { ssr: false },
) as unknown as React.ComponentType<{
  onEmojiClick: (emojiData: { emoji: string }) => void;
  width?: number | string;
  height?: number | string;
  theme?: "dark" | "light" | "auto";
}>;

interface ChatWindowProps {
  user: User;
  selectedChat: ChatSession | null;
  onSendMessage: (content: string) => Promise<void>;
}

export default function ChatWindow({
  user,
  selectedChat,
  onSendMessage,
}: ChatWindowProps) {
  type SenderLite = {
    id: string;
    avatar_url?: string | null;
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
  };
  type UIMessage = Omit<Message, "sender"> & {
    sender?: SenderLite;
    reads?: { user_id: string }[];
  };
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiContainerRef = useRef<HTMLDivElement | null>(null);
  const gifContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const [readByMap, setReadByMap] = useState<Record<string, string[]>>({});
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  // Context menu and edit state
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    messageId: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [isRoomAdmin, setIsRoomAdmin] = useState<boolean>(false);
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // GIF picker state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifResults, setGifResults] = useState<
    Array<{ id: string; url: string; preview: string }>
  >([]);
  type GifProvider = "tenor" | "giphy" | null;
  const tenorKey =
    (process.env.NEXT_PUBLIC_TENOR_KEY as string | undefined) || undefined;
  const giphyKey =
    (process.env.NEXT_PUBLIC_GIPHY_KEY as string | undefined) || undefined;
  const [gifProvider, setGifProvider] = useState<GifProvider>(null);

  // Minimal response types for Tenor and Giphy APIs
  type TenorMediaVariant = { url?: string };
  type TenorResult = {
    id?: string | number;
    media_formats?: { gif?: TenorMediaVariant; tinygif?: TenorMediaVariant };
    media?: Array<{ gif?: TenorMediaVariant; tinygif?: TenorMediaVariant }>;
  };
  type TenorResponse = { results?: TenorResult[] };
  type GiphyImages = {
    downsized?: { url?: string };
    original?: { url?: string };
    preview_gif?: { url?: string };
    downsized_still?: { url?: string };
  };
  type GiphyResult = { id?: string | number; images?: GiphyImages };
  type GiphyResponse = { data?: GiphyResult[] };
  // Typing indicator state
  const [typingOthers, setTypingOthers] = useState<string[]>([]);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef<boolean>(false);

  // Track focus/visibility to control when reads are recorded
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
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedChat) return;
    fetchMessages();
    const cleanupMsg = setupMessageSubscription();
    const cleanupReads = setupReadReceiptsSubscription();
    const cleanupTyping = setupTypingPresence();
    return () => {
      if (typeof cleanupMsg === "function") cleanupMsg();
      if (typeof cleanupReads === "function") cleanupReads();
      if (typeof cleanupTyping === "function") cleanupTyping();
    };
  }, [selectedChat]);

  // Close emoji picker when clicking outside or pressing Escape
  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        emojiContainerRef.current &&
        target &&
        !emojiContainerRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmojiPicker(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showEmojiPicker]);

  // Close GIF picker when clicking outside or pressing Escape
  useEffect(() => {
    if (!showGifPicker) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        gifContainerRef.current &&
        target &&
        !gifContainerRef.current.contains(target)
      ) {
        setShowGifPicker(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGifPicker(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showGifPicker]);

  // Pick default GIF provider based on available keys
  useEffect(() => {
    if (tenorKey) setGifProvider("tenor");
    else if (giphyKey) setGifProvider("giphy");
    else setGifProvider(null);
  }, [tenorKey, giphyKey]);

  const fetchTrendingGifs = async () => {
    if (!gifProvider) return;
    setGifLoading(true);
    try {
      if (gifProvider === "tenor" && tenorKey) {
        const params = new URLSearchParams({
          key: tenorKey,
          limit: "24",
          media_filter: "gif",
        });
        const res = await fetch(
          `https://tenor.googleapis.com/v2/featured?${params.toString()}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as TenorResponse | null;
        const items: Array<{ id: string; url: string; preview: string }> = (
          json?.results || []
        )
          .map((r: TenorResult) => {
            const gifUrl: string | undefined =
              r?.media_formats?.gif?.url || r?.media?.[0]?.gif?.url;
            const tinyUrl: string | undefined =
              r?.media_formats?.tinygif?.url ||
              r?.media?.[0]?.tinygif?.url ||
              gifUrl;
            return {
              id: String(r?.id ?? crypto.randomUUID()),
              url: gifUrl || "",
              preview: tinyUrl || gifUrl || "",
            };
          })
          .filter((i) => i.url);
        setGifResults(items);
      } else if (gifProvider === "giphy" && giphyKey) {
        const params = new URLSearchParams({
          api_key: giphyKey,
          limit: "24",
          rating: "pg",
        });
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/trending?${params.toString()}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as GiphyResponse | null;
        const items: Array<{ id: string; url: string; preview: string }> = (
          json?.data || []
        )
          .map((r: GiphyResult) => {
            const gifUrl: string | undefined =
              r?.images?.downsized?.url || r?.images?.original?.url;
            const preview: string | undefined =
              r?.images?.preview_gif?.url ||
              r?.images?.downsized_still?.url ||
              gifUrl;
            return {
              id: String(r?.id ?? crypto.randomUUID()),
              url: gifUrl || "",
              preview: preview || gifUrl || "",
            };
          })
          .filter((i) => i.url);
        setGifResults(items);
      }
    } catch (e) {
      console.error("Failed to load trending GIFs", e);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!gifProvider) return;
    const q = query.trim();
    if (!q) {
      await fetchTrendingGifs();
      return;
    }
    setGifLoading(true);
    try {
      if (gifProvider === "tenor" && tenorKey) {
        const params = new URLSearchParams({
          key: tenorKey,
          q,
          limit: "24",
          media_filter: "gif",
        });
        const res = await fetch(
          `https://tenor.googleapis.com/v2/search?${params.toString()}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as TenorResponse | null;
        const items: Array<{ id: string; url: string; preview: string }> = (
          json?.results || []
        )
          .map((r: TenorResult) => {
            const gifUrl: string | undefined =
              r?.media_formats?.gif?.url || r?.media?.[0]?.gif?.url;
            const tinyUrl: string | undefined =
              r?.media_formats?.tinygif?.url ||
              r?.media?.[0]?.tinygif?.url ||
              gifUrl;
            return {
              id: String(r?.id ?? crypto.randomUUID()),
              url: gifUrl || "",
              preview: tinyUrl || gifUrl || "",
            };
          })
          .filter((i) => i.url);
        setGifResults(items);
      } else if (gifProvider === "giphy" && giphyKey) {
        const params = new URLSearchParams({
          api_key: giphyKey,
          q,
          limit: "24",
          rating: "pg",
        });
        const res = await fetch(
          `https://api.giphy.com/v1/gifs/search?${params.toString()}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as GiphyResponse | null;
        const items: Array<{ id: string; url: string; preview: string }> = (
          json?.data || []
        )
          .map((r: GiphyResult) => {
            const gifUrl: string | undefined =
              r?.images?.downsized?.url || r?.images?.original?.url;
            const preview: string | undefined =
              r?.images?.preview_gif?.url ||
              r?.images?.downsized_still?.url ||
              gifUrl;
            return {
              id: String(r?.id ?? crypto.randomUUID()),
              url: gifUrl || "",
              preview: preview || gifUrl || "",
            };
          })
          .filter((i) => i.url);
        setGifResults(items);
      }
    } catch (e) {
      console.error("GIF search failed", e);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  // Determine if current user is admin of the selected room (for delete permissions)
  useEffect(() => {
    const fetchRole = async () => {
      if (!selectedChat || selectedChat.type !== "room") {
        setIsRoomAdmin(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("room_members")
          .select("role")
          .eq("room_id", selectedChat.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsRoomAdmin(
          (data?.role as "admin" | "member" | undefined) === "admin",
        );
      } catch {
        setIsRoomAdmin(false);
      }
    };
    fetchRole();
  }, [selectedChat?.id, selectedChat?.type, supabase, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When switching/opening a chat and after initial load completes, snap to bottom
  useEffect(() => {
    if (!selectedChat) return;
    if (!loading) {
      // Delay to allow DOM to paint
      setTimeout(() => scrollToBottom(false), 0);
    }
  }, [selectedChat, loading]);

  // Auto-focus the message input when entering a chat and after messages load
  useEffect(() => {
    if (!selectedChat) return;
    if (loading) return;
    const input = messageInputRef.current;
    if (!input) return;
    // Defer to ensure element is laid out
    const id = window.setTimeout(() => {
      try {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } catch {}
    }, 0);
    return () => window.clearTimeout(id);
  }, [selectedChat, loading]);

  // If there are images, scroll again once they finish loading to ensure bottom stays in view
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const images: HTMLImageElement[] = Array.from(
      container.querySelectorAll("img"),
    );
    if (images.length === 0) return;
    const onLoad = () => scrollToBottom(false);
    images.forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", onLoad);
      img.addEventListener("error", onLoad);
    });
    return () => {
      images.forEach((img) => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onLoad);
      });
    };
  }, [messages, selectedChat]);

  // Ensure the message input is focused when entering or switching chats
  useEffect(() => {
    if (!selectedChat) return;
    const focusInput = () => {
      const el = messageInputRef.current;
      if (!el) return;
      el.focus();
      try {
        const length = el.value.length;
        el.setSelectionRange(length, length);
      } catch {}
    };
    // Focus immediately and after paint
    focusInput();
    const id = window.setTimeout(focusInput, 0);
    return () => {
      window.clearTimeout(id);
    };
  }, [selectedChat]);

  const fetchMessages = async () => {
    if (!selectedChat) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `*, reads:message_reads(user_id), sender:users!messages_sender_id_fkey(id, avatar_url, full_name, email, username)`,
        )
        .eq(
          selectedChat.type === "dm" ? "direct_message_id" : "room_id",
          selectedChat.id,
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      const msgs = (data || []) as UIMessage[];
      const map: Record<string, string[]> = {};
      msgs.forEach((m) => {
        map[m.id] = (m.reads || []).map((r: { user_id: string }) => r.user_id);
      });
      setReadByMap(map);
      // Normalize sender object to expected shape (defensive)
      setMessages(
        msgs.map((m) => ({
          ...m,
          sender: m.sender
            ? {
                id: m.sender.id,
                avatar_url: m.sender.avatar_url ?? null,
                full_name: m.sender.full_name ?? null,
                email: m.sender.email ?? null,
                username: m.sender.username ?? null,
              }
            : undefined,
        })),
      );
    } catch (error) {
      console.error(
        "Error fetching messages:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      setLoading(false);
    }
  };

  const setupMessageSubscription = () => {
    if (!selectedChat) return;

    const channel = supabase
      .channel(`messages:${selectedChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            selectedChat.type === "dm"
              ? `direct_message_id=eq.${selectedChat.id}`
              : `room_id=eq.${selectedChat.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as UIMessage;
          // Hydrate sender profile for avatar/labels
          try {
            const { data: profile } = await supabase
              .from("users")
              .select("id, avatar_url, full_name, email, username")
              .eq("id", newMessage.sender_id)
              .maybeSingle();
            if (profile) {
              const hydrated: UIMessage = {
                ...newMessage,
                sender: {
                  id: profile.id,
                  avatar_url: profile.avatar_url ?? null,
                  full_name: profile.full_name ?? null,
                  email: profile.email ?? null,
                  username: profile.username ?? null,
                },
              };
              setMessages((prev) => [...prev, hydrated]);
              return;
            }
          } catch {}
          setMessages((prev) => [...prev, newMessage]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter:
            selectedChat.type === "dm"
              ? `direct_message_id=eq.${selectedChat.id}`
              : `room_id=eq.${selectedChat.id}`,
        },
        (payload) => {
          const updated = payload.new as UIMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    content: updated.content,
                    updated_at: updated.updated_at,
                  }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter:
            selectedChat.type === "dm"
              ? `direct_message_id=eq.${selectedChat.id}`
              : `room_id=eq.${selectedChat.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
          setReadByMap((prev) => {
            const copy = { ...prev };
            delete copy[oldRow.id];
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const setupReadReceiptsSubscription = () => {
    if (!selectedChat) return;

    const channel = supabase
      .channel("message_reads")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reads",
        },
        (payload) => {
          const { message_id, user_id } = payload.new as {
            message_id: string;
            user_id: string;
          };
          setReadByMap((prev) => {
            const current = prev[message_id] || [];
            if (current.includes(user_id)) return prev;
            return { ...prev, [message_id]: [...current, user_id] };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Compute a display label for current user to share over presence
  const getCurrentUserDisplayName = () => {
    const fullName =
      (user.user_metadata as { full_name?: string } | undefined)?.full_name ||
      null;
    const email = user.email || "";
    const username = emailToUsername(email);
    return fullName ? `${fullName} (${username})` : username || "Someone";
  };

  const setupTypingPresence = () => {
    if (!selectedChat) return;

    // Clean any existing typing channel before creating a new one
    if (typingChannelRef.current) {
      try {
        supabase.removeChannel(typingChannelRef.current);
      } catch {}
      typingChannelRef.current = null;
    }

    const channel = supabase.channel(`typing:${selectedChat.id}`, {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      try {
        const state = channel.presenceState() as Record<
          string,
          Array<{ typing?: boolean; name?: string }>
        >;
        const names: string[] = [];
        Object.entries(state).forEach(([key, metas]) => {
          if (key === user.id) return;
          const latest = metas[metas.length - 1];
          if (latest?.typing && latest?.name) names.push(latest.name);
        });
        setTypingOthers(names);
      } catch {
        setTypingOthers([]);
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({
          typing: false,
          name: getCurrentUserDisplayName(),
          chatId: selectedChat.id,
        });
      }
    });

    typingChannelRef.current = channel;

    return () => {
      // Ensure we clear our typing state and remove channel
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isTypingRef.current = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
      typingChannelRef.current = null;
      setTypingOthers([]);
    };
  };

  const startTyping = () => {
    const channel = typingChannelRef.current;
    if (!channel || !selectedChat) return;
    if (!isTypingRef.current) {
      channel.track({
        typing: true,
        name: getCurrentUserDisplayName(),
        chatId: selectedChat.id,
      });
      isTypingRef.current = true;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    const channel = typingChannelRef.current;
    if (!channel || !selectedChat) return;
    if (isTypingRef.current) {
      channel.track({
        typing: false,
        name: getCurrentUserDisplayName(),
        chatId: selectedChat.id,
      });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const sendCurrentMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setSending(true);
    try {
      await onSendMessage(newMessage.trim());
      stopTyping();
      setNewMessage("");
      // reset textarea height after send
      if (messageInputRef.current) {
        messageInputRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // After sending completes, ensure the textarea regains focus
  useEffect(() => {
    if (sending) return;
    if (!selectedChat) return;
    const el = messageInputRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      try {
        el.focus();
        const length = el.value.length;
        el.setSelectionRange(length, length);
      } catch {}
    });
    return () => {
      try {
        window.cancelAnimationFrame(id);
      } catch {}
    };
  }, [sending, selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCurrentMessage();
  };

  const autoResizeTextArea = (el: HTMLTextAreaElement) => {
    const maxHeight = 120;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  };

  const insertEmojiAtCaret = (emoji: string) => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      setNewMessage((prev) => `${prev}${emoji}`);
      return;
    }
    const start = textarea.selectionStart ?? newMessage.length;
    const end = textarea.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const after = newMessage.slice(end);
    const next = `${before}${emoji}${after}`;
    setNewMessage(next);
    // restore caret just after the inserted emoji
    requestAnimationFrame(() => {
      try {
        textarea.focus();
        const caretPos = start + emoji.length;
        textarea.selectionStart = caretPos;
        textarea.selectionEnd = caretPos;
        autoResizeTextArea(textarea);
        startTyping();
      } catch {}
    });
  };

  const uploadToImgbbClient = async (
    file: File,
    apiKey: string,
  ): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result as string;
          const commaIndex = result.indexOf(",");
          const b64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
          resolve(b64);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () =>
        reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

    const body = new URLSearchParams();
    body.append("image", base64);

    const res = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      },
    );
    type ImgbbResponse = {
      data?: { display_url?: string; url?: string; image?: { url?: string } };
    };
    const json = (await res.json().catch(() => null)) as ImgbbResponse | null;
    if (!res.ok || !json) {
      throw new Error("imgbb upload failed");
    }
    const url: string | undefined =
      json?.data?.display_url || json?.data?.url || json?.data?.image?.url;
    if (!url) throw new Error("imgbb did not return a URL");
    return url;
  };

  // File uploads are restricted to images only; non-image flows removed

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    try {
      setUploadingFile(true);
      const isImage = !!file.type?.startsWith("image/");
      const imgbbKey = process.env.NEXT_PUBLIC_IMGBB_KEY as string | undefined;

      if (!isImage) {
        alert("Only image uploads are allowed");
        return;
      }

      if (!imgbbKey) {
        throw new Error(
          "Image uploads require imgbb. Missing NEXT_PUBLIC_IMGBB_KEY.",
        );
      }
      const url = await uploadToImgbbClient(file, imgbbKey);
      await onSendMessage(url);
    } catch (err) {
      console.error("File upload failed", err);
      alert(err instanceof Error ? err.message : "File upload failed");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const scrollToBottom = (smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isDeletedMessage = (m: UIMessage): boolean =>
    m.content.trim() === "[Deleted Message]";
  const isEditedMessage = (m: UIMessage): boolean => {
    if (!m.updated_at || !m.created_at) return false;
    // Consider edited if timestamps differ
    return (
      new Date(m.updated_at).getTime() !== new Date(m.created_at).getTime()
    );
  };

  const canEditMessage = (message: UIMessage) => message.sender_id === user.id;
  const canDeleteMessage = (message: UIMessage) => {
    if (message.sender_id === user.id) return true;
    if (selectedChat?.type === "room" && isRoomAdmin) return true;
    return false;
  };

  const openContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, messageId });
  };

  useEffect(() => {
    const onGlobalClick = () => setContextMenu(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setContextMenu(null);
        setEditingId(null);
      }
    };
    window.addEventListener("click", onGlobalClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onGlobalClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const beginEdit = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    setEditingId(id);
    setEditText(msg.content);
    setContextMenu(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const content = editText.trim();
    if (!content) return;
    try {
      const nowIso = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ content, updated_at: nowIso })
        .eq("id", editingId);
      // Optimistic update; realtime will also reflect
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? ({ ...m, content, updated_at: nowIso } as UIMessage)
            : m,
        ),
      );
    } catch (e) {
      console.error("Failed to edit message", e);
    } finally {
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteMessage = async (id: string) => {
    setContextMenu(null);
    try {
      const ok = window.confirm("Delete this message?");
      if (!ok) return;
      const nowIso = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ content: "[Deleted Message]", updated_at: nowIso })
        .eq("id", id);
      // Optimistic soft-delete; realtime will also reflect
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, content: "[Deleted Message]", updated_at: nowIso }
            : m,
        ),
      );
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  };

  // Fix: handle empty or invalid URLs gracefully
  const extractUrlParts = (
    url: string,
  ): {
    filename: string | null;
    extension: string | null;
    host: string | null;
  } => {
    if (!url || typeof url !== "string") {
      return { filename: null, extension: null, host: null };
    }
    try {
      const u = new URL(url);
      const pathname = decodeURIComponent(u.pathname || "");
      const segments = pathname.split("/").filter(Boolean);
      const filename = segments[segments.length - 1] || null;
      const match = filename
        ? filename.match(/\.([a-z0-9]+)(?:\?.*)?$/i)
        : null;
      const extension = match ? match[1].toLowerCase() : null;
      return { filename, extension, host: u.host || null };
    } catch {
      return { filename: null, extension: null, host: null };
    }
  };

  useEffect(() => {
    const markReadReceipts = async () => {
      if (!selectedChat || messages.length === 0) return;
      // Do not mark as read unless the tab is focused and visible
      if (!isWindowFocused || !isTabVisible) return;
      const unseen = messages.filter(
        (m) =>
          m.sender_id !== user.id && !(readByMap[m.id] || []).includes(user.id),
      );
      if (unseen.length === 0) return;
      const rows = unseen.map((m) => ({ message_id: m.id, user_id: user.id }));
      await supabase
        .from("message_reads")
        .upsert(rows, { onConflict: "message_id,user_id" });
    };
    markReadReceipts();
  }, [messages, selectedChat, isWindowFocused, isTabVisible]);

  if (!selectedChat) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>💬</div>
        <h2>Select a chat to start messaging</h2>
        <p>Choose a direct message or room from the sidebar</p>
      </div>
    );
  }

  return (
    <div className={styles.chatWindow}>
      <div className={styles.header}>
        <div className={styles.chatInfo}>
          <h2 className={styles.chatName}>{selectedChat.name}</h2>
          <p className={styles.chatType}>
            {selectedChat.type === "dm" ? "Direct Message" : "Room"}
          </p>
        </div>
        {selectedChat.type === "room" && (
          <div className={styles.roomActions}>
            <button
              className={styles.inviteButton}
              onClick={async () => {
                if (!selectedChat.inviteCode) return;
                const url = `${window.location.origin}/invite/${selectedChat.inviteCode}`;
                try {
                  await navigator.clipboard.writeText(url);
                  alert("Invite link copied to clipboard");
                } catch {
                  prompt("Copy invite link:", url);
                }
              }}
            >
              Invite
            </button>
          </div>
        )}
      </div>

      <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {loading ? (
          <div className={styles.loadingMessages}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading messages...</p>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map((message) => {
              const isOwn = message.sender_id === user.id;
              return (
                <div
                  key={message.id}
                  className={`${styles.message} ${isOwn ? styles.ownMessage : ""}`}
                  onContextMenu={(e) => openContextMenu(e, message.id)}
                >
                  <div className={styles.messageRow}>
                    {!isOwn && (
                      <div className={styles.avatar} aria-hidden>
                        {(() => {
                          const a = message.sender?.avatar_url;
                          if (a) {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                            );
                          }
                          const initial = (
                            message.sender?.full_name?.[0] ||
                            message.sender_username?.[0] ||
                            message.sender_email?.[0] ||
                            "U"
                          ).toUpperCase();
                          return initial;
                        })()}
                      </div>
                    )}
                    <div className={styles.messageContent}>
                      <div className={styles.messageSender}>
                        {(() => {
                          const explicitUsername =
                            message.sender_username || null;
                          const derivedUsername = isOwn
                            ? emailToUsername(user.email)
                            : null;
                          const username =
                            explicitUsername || derivedUsername || null;

                          const explicitFullName = message.sender_name || null;
                          const derivedFullName = isOwn
                            ? (user.user_metadata as { full_name?: string })
                                ?.full_name || null
                            : null;
                          const fullName =
                            explicitFullName || derivedFullName || null;

                          if (fullName && username)
                            return `${fullName} (${username})`;
                          if (fullName) return fullName;
                          if (username) return username;
                          if (message.sender_email)
                            return (
                              emailToUsername(message.sender_email) ||
                              message.sender_email
                            );
                          return isOwn ? "You" : "Unknown";
                        })()}
                      </div>
                      {(() => {
                        if (isDeletedMessage(message)) {
                          return (
                            <div className={styles.deletedMessage}>
                              [Deleted Message]
                            </div>
                          );
                        }
                        if (
                          editingId === message.id &&
                          canEditMessage(message)
                        ) {
                          return (
                            <div
                              className={styles.messageText}
                              style={{ maxWidth: "100%" }}
                            >
                              <textarea
                                className={styles.editTextarea}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={3}
                              />
                              <div className={styles.editActions}>
                                <button
                                  type="button"
                                  className={styles.editSave}
                                  onClick={saveEdit}
                                  disabled={!editText.trim()}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className={styles.editCancel}
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          );
                        }
                        const content = message.content;
                        const isUrl = /^https?:/i.test(content);
                        if (!isUrl)
                          return (
                            <div className={styles.messageText}>
                               <ReactMarkdown
                                 remarkPlugins={[remarkGfm, remarkBreaks]}
                                 rehypePlugins={[rehypeSpoiler]}
                                 skipHtml
                                 components={{
                                  a: ({ children, ...props }) => (
                                    <a
                                      {...props}
                                      target="_blank"
                                      rel="noopener noreferrer nofollow"
                                    >
                                      {children}
                                    </a>
                                  ),
                                   span: ({ node, ...props }) => {
                                     const className = (props.className || '') as string
                                     if (className.split(' ').includes('spoiler')) {
                                       return (
                                         <span
                                           {...props}
                                           className={`${styles.spoiler} ${className}`}
                                           role="button"
                                           tabIndex={0}
                                           onClick={(e) => {
                                             const el = e.currentTarget as HTMLElement
                                             el.classList.toggle(styles.spoilerRevealed)
                                           }}
                                           onKeyDown={(e) => {
                                             if (e.key === 'Enter' || e.key === ' ') {
                                               e.preventDefault()
                                               const el = e.currentTarget as HTMLElement
                                               el.classList.toggle(styles.spoilerRevealed)
                                             }
                                           }}
                                         />
                                       )
                                     }
                                     return <span {...props} />
                                   },
                                  img: ({ ...props }) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
                                      style={{
                                        maxWidth: 320,
                                        borderRadius: 12,
                                      }}
                                    />
                                  ),
                                }}
                              >
                                {content}
                              </ReactMarkdown>
                            </div>
                          );

                        const isImage =
                          /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif|\.svg)(?:\?.*)?$/i.test(
                            content,
                          ) || /\/i\.ibb\.co\//i.test(content);
                        if (isImage) {
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={content}
                              alt="Shared image"
                              style={{ maxWidth: "320px", borderRadius: 12 }}
                            />
                          );
                        }

                        // ImpactStream -> vidsrc embed resolution
                        const isImpactStream = (() => {
                          try {
                            const u = new URL(content);
                            return (
                              ["impactstream.vercel.app", "www.impactstream.vercel.app"].includes(
                                u.hostname,
                              ) && (/^\/tv\//.test(u.pathname) || /^\/movie\//.test(u.pathname))
                            );
                          } catch {
                            return false;
                          }
                        })();

                        if (isImpactStream) {
                          const ImpactStreamEmbed: React.FC<{ pageUrl: string }> = ({ pageUrl }) => {
                            const [embedUrl, setEmbedUrl] = useState<string | null>(null);
                            const [loading, setLoading] = useState<boolean>(true);
                            const [failed, setFailed] = useState<boolean>(false);
                            useEffect(() => {
                              let mounted = true;
                              const run = async () => {
                                try {
                                  const res = await fetch(`/api/impactstream/resolve?url=${encodeURIComponent(pageUrl)}`, {
                                    cache: "no-store",
                                  });
                                  const json = (await res.json().catch(() => null)) as { ok?: boolean; embedUrl?: string } | null;
                                  if (!mounted) return;
                                  if (res.ok && json?.ok && json.embedUrl) {
                                    setEmbedUrl(json.embedUrl);
                                  } else {
                                    setFailed(true);
                                  }
                                } catch {
                                  if (!mounted) return;
                                  setFailed(true);
                                } finally {
                                  if (mounted) setLoading(false);
                                }
                              };
                              run();
                              return () => {
                                mounted = false;
                              };
                            }, [pageUrl]);

                            if (loading) {
                              return (
                                <div style={{ width: 360, height: 203, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "var(--color-bg-muted)" }}>
                                  <span style={{ opacity: 0.7 }}>Loading player...</span>
                                </div>
                              );
                            }
                            if (failed || !embedUrl) {
                              return (
                                <a href={pageUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ color: "var(--color-text)" }}>
                                  Open on ImpactStream
                                </a>
                              );
                            }
                            return (
                              <iframe
                                src={embedUrl}
                                style={{ width: 360, height: 203, border: 0, borderRadius: 12 }}
                                allowFullScreen
                                loading="lazy"
                              />
                            );
                          };

                          return <ImpactStreamEmbed pageUrl={content} />;
                        }

                        const { filename, extension, host } =
                          extractUrlParts(content);
                        const isFilebin = (host || "").includes("filebin.net");

                        const isVideo =
                          /(\.mp4|\.webm|\.ogg|\.mov|\.m4v)(?:\?.*)?$/i.test(
                            content,
                          );
                        if (isVideo && !isFilebin) {
                          return (
                            <video
                              src={content}
                              controls
                              style={{ maxWidth: 360, borderRadius: 12 }}
                            />
                          );
                        }

                        const isAudio =
                          /(\.mp3|\.wav|\.ogg|\.m4a|\.aac)(?:\?.*)?$/i.test(
                            content,
                          );
                        if (isAudio && !isFilebin) {
                          return (
                            <audio
                              src={content}
                              controls
                              style={{ maxWidth: 360 }}
                            />
                          );
                        }

                        const ext = (extension || "file").toLowerCase();
                        const icon = (() => {
                          if (["pdf"].includes(ext)) return "📄";
                          if (
                            ["doc", "docx", "rtf", "odt", "md", "txt"].includes(
                              ext,
                            )
                          )
                            return "📝";
                          if (["xls", "xlsx", "csv", "ods"].includes(ext))
                            return "📊";
                          if (["ppt", "pptx", "odp"].includes(ext)) return "📈";
                          if (["zip", "rar", "7z", "gz", "tar"].includes(ext))
                            return "🗜️";
                          if (
                            ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext)
                          )
                            return "🎞️";
                          if (["mp3", "wav", "m4a", "aac"].includes(ext))
                            return "🎧";
                          if (
                            [
                              "png",
                              "jpg",
                              "jpeg",
                              "gif",
                              "webp",
                              "avif",
                              "svg",
                            ].includes(ext)
                          )
                            return "🖼️";
                          return "📦";
                        })();

                        return (
                          <div className={styles.fileAttachment}>
                            <div className={styles.fileIcon} aria-hidden>
                              {icon}
                            </div>
                            <div className={styles.fileBody}>
                              <div
                                className={styles.fileName}
                                title={filename || content}
                              >
                                {filename || content}
                              </div>
                              <div className={styles.fileMeta}>
                                {ext.toUpperCase()}
                                {host ? ` · ${host}` : ""}
                              </div>
                            </div>
                            <div className={styles.fileActions}>
                              <a
                                href={content}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.fileButton}
                              >
                                Open
                              </a>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {isOwn && (
                      <div className={styles.avatar} aria-hidden>
                        {(() => {
                          const a =
                            message.sender?.avatar_url ||
                            (user.user_metadata as { avatar_url?: string })
                              ?.avatar_url;
                          if (a) {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                            );
                          }
                          const fullName =
                            (user.user_metadata as { full_name?: string })
                              ?.full_name ||
                            message.sender?.full_name ||
                            null;
                          const initial = (
                            fullName?.[0] ||
                            user.email?.[0] ||
                            message.sender_username?.[0] ||
                            "U"
                          ).toUpperCase();
                          return initial;
                        })()}
                      </div>
                    )}
                  </div>
                  <div
                    className={`${styles.metaRow} ${isOwn ? styles.metaRight : styles.metaLeft}`}
                  >
                    <div className={styles.messageTime}>
                      {formatTime(message.created_at)}
                      {isEditedMessage(message) && !isDeletedMessage(message)
                        ? " - edited"
                        : ""}
                    </div>
                    {isOwn && (
                      <div className={styles.readReceipt}>
                        {(() => {
                          const readers = readByMap[message.id] || [];
                          if (selectedChat.type === "dm") {
                            const read = readers.some((rid) => rid !== user.id);
                            return read ? "Read" : "Sent";
                          }
                          const count = readers.filter(
                            (rid) => rid !== user.id,
                          ).length;
                          return count > 0 ? `Read by ${count}` : "Sent";
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className={styles.messageForm}>
        {typingOthers.length > 0 && (
          <div className={styles.typingIndicator} aria-live="polite">
            {(() => {
              const names = typingOthers;
              if (names.length === 1) return `${names[0]} is typing...`;
              if (names.length === 2)
                return `${names[0]} and ${names[1]} are typing...`;
              return "Several people are typing...";
            })()}
          </div>
        )}
        <div className={styles.inputContainer}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleUploadFile}
          />
          <button
            type="button"
            className={styles.sendButton}
            title="Upload file"
            aria-label="Upload file"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg className={styles.sendIcon} viewBox="0 0 24 24">
                <path
                  d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 6l-4-4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 2v14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
          <div className={styles.emojiContainer} ref={gifContainerRef}>
            <button
              type="button"
              className={styles.emojiButton}
              title="Insert GIF"
              aria-label="Insert GIF"
              onClick={async () => {
                setShowGifPicker((prev) => !prev);
                setShowEmojiPicker(false);
                if (!showGifPicker) {
                  // Initial load
                  await fetchTrendingGifs();
                }
              }}
              disabled={!gifProvider}
            >
              <span className={styles.gifLabel}>GIF</span>
            </button>
            {showGifPicker && (
              <div
                className={styles.gifPopover}
                onClick={(e) => e.stopPropagation()}
              >
                {!gifProvider ? (
                  <div className={styles.gifEmpty}>
                    <p>
                      Configure <code>NEXT_PUBLIC_TENOR_KEY</code> or{" "}
                      <code>NEXT_PUBLIC_GIPHY_KEY</code> to enable GIF search.
                    </p>
                  </div>
                ) : (
                  <div className={styles.gifPanel}>
                    <div className={styles.gifSearchRow}>
                      <input
                        className={styles.gifSearchInput}
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            await searchGifs(gifQuery);
                          }
                        }}
                        placeholder={`Search ${gifProvider === "tenor" ? "Tenor" : "Giphy"} GIFs...`}
                      />
                      <button
                        type="button"
                        className={styles.gifSearchButton}
                        onClick={() => searchGifs(gifQuery)}
                        disabled={gifLoading}
                      >
                        {gifLoading ? "..." : "Search"}
                      </button>
                    </div>
                    <div className={styles.gifGrid}>
                      {gifLoading ? (
                        <div className={styles.gifLoading}>Loading...</div>
                      ) : (
                        gifResults.map((g) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={g.id}
                            src={g.preview}
                            alt="GIF"
                            className={styles.gifItem}
                            onClick={async () => {
                              try {
                                await onSendMessage(g.url);
                                setShowGifPicker(false);
                                setGifQuery("");
                              } catch (e) {
                                console.error("Failed to send GIF", e);
                              }
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles.emojiContainer} ref={emojiContainerRef}>
            <button
              type="button"
              className={styles.emojiButton}
              title="Insert emoji"
              aria-label="Insert emoji"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              <span role="img" aria-label="emoji">
                😊
              </span>
            </button>
            {showEmojiPicker && (
              <div
                className={styles.emojiPopover}
                onClick={(e) => e.stopPropagation()}
              >
                {/* width/height to keep picker compact; theme follows app theme */}
                {typeof window !== "undefined" && (
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      insertEmojiAtCaret(emojiData.emoji);
                    }}
                    width={320}
                    height={420}
                    theme={
                      document.documentElement.getAttribute("data-theme") ===
                      "dark"
                        ? "dark"
                        : "light"
                    }
                  />
                )}
              </div>
            )}
          </div>
          <textarea
            ref={messageInputRef}
            rows={1}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              autoResizeTextArea(e.currentTarget);
              startTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && newMessage.trim()) {
                  void sendCurrentMessage();
                }
              }
            }}
            onBlur={() => {
              stopTyping();
            }}
            placeholder="Type a message..."
            className={styles.messageInput}
            disabled={sending}
            style={{ overflow: "hidden" }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={styles.sendButton}
          >
            {sending ? (
              <div className={styles.sendingSpinner}></div>
            ) : (
              <svg className={styles.sendIcon} viewBox="0 0 24 24">
                <path
                  d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const msg = messages.find((m) => m.id === contextMenu.messageId);
            if (!msg) return null;
            const items: Array<{
              key: string;
              label: string;
              onClick: () => void;
              show: boolean;
            }> = [
              {
                key: "edit",
                label: "Edit",
                onClick: () => beginEdit(msg.id),
                show: canEditMessage(msg) && !isDeletedMessage(msg),
              },
              {
                key: "delete",
                label: "Delete",
                onClick: () => handleDeleteMessage(msg.id),
                show: canDeleteMessage(msg) && !isDeletedMessage(msg),
              },
            ];
            return (
              <>
                {items
                  .filter((i) => i.show)
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.contextMenuItem}
                      onClick={item.onClick}
                    >
                      {item.label}
                    </button>
                  ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

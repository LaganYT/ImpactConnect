"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToastContext } from "./ToastProvider";
import styles from "./PollCard.module.css";

type PollContent = {
  type: "poll";
  question: string;
  options: string[];
  multiple?: boolean;
  expires_at?: string | null;
};

interface PollCardProps {
  messageId: string;
  content: string; // JSON string of PollContent
  userId: string;
}

type Vote = { message_id: string; user_id: string; option_index: number };

export default function PollCard({ messageId, content, userId }: PollCardProps) {
  const supabase = createClient();
  const toast = useToastContext();
  const poll: PollContent | null = useMemo(() => {
    try {
      const parsed = JSON.parse(content) as PollContent;
      if (parsed && parsed.type === "poll" && Array.isArray(parsed.options)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [content]);

  const [votes, setVotes] = useState<Vote[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchVotes = async () => {
      const { data } = await supabase
        .from("poll_votes")
        .select("message_id,user_id,option_index")
        .eq("message_id", messageId);
      if (!active) return;
      setVotes((data as Vote[]) || []);
    };
    fetchVotes();
    // Subscribe to realtime vote changes for this poll
    const channel = supabase
      .channel(`poll_votes:${messageId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes", filter: `message_id=eq.${messageId}` },
        (payload) => {
          const row = payload.new as Vote;
          setVotes((prev) => {
            const next = prev.filter(
              (v) => !(v.user_id === row.user_id && v.message_id === row.message_id),
            );
            next.push(row);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "poll_votes", filter: `message_id=eq.${messageId}` },
        (payload) => {
          const row = payload.new as Vote;
          setVotes((prev) => prev.map((v) => (v.user_id === row.user_id ? row : v)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "poll_votes", filter: `message_id=eq.${messageId}` },
        (payload) => {
          const row = payload.old as Vote;
          setVotes((prev) => prev.filter((v) => !(v.user_id === row.user_id && v.message_id === row.message_id)));
        },
      )
      .subscribe();

    return () => {
      active = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [messageId, supabase]);

  if (!poll) return null;

  const expiresAt: Date | null = (() => {
    if (!poll.expires_at) return null;
    const d = new Date(poll.expires_at);
    return isNaN(d.getTime()) ? null : d;
  })();
  const isExpired = !!(expiresAt && expiresAt.getTime() <= Date.now());

  const totalVotes = votes.length;
  const counts = poll.options.map(
    (_opt, idx) => votes.filter((v) => v.option_index === idx).length,
  );
  const myVote = votes.find((v) => v.user_id === userId) || null;

  const castVote = async (idx: number) => {
    if (saving) return;
    if (isExpired) return;
    setSaving(true);
    try {
      await supabase
        .from("poll_votes")
        .upsert(
          { message_id: messageId, user_id: userId, option_index: idx },
          { onConflict: "message_id,user_id" },
        );
    } catch (e) {
      console.error("Failed to cast vote", e);
      toast.error("Failed to cast vote");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.pollCard}>
      <div className={styles.question}>{poll.question}</div>
      <div className={styles.options}>
        {poll.options.map((opt, idx) => {
          const count = counts[idx] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMine = myVote?.option_index === idx;
          return (
            <button
              key={idx}
              type="button"
              className={`${styles.option} ${isMine ? styles.selected : ""}`}
              onClick={() => castVote(idx)}
              disabled={saving || isExpired}
            >
              <div className={styles.optionTop}>
                <span className={styles.optionLabel}>{opt}</span>
                <span className={styles.optionCount}>{count}</span>
              </div>
              <div className={styles.meter} aria-hidden>
                <div className={styles.bar} style={{ width: `${pct}%` }} />
              </div>
              <div className={styles.percent}>{pct}%</div>
            </button>
          );
        })}
      </div>
      <div className={styles.footer}>
        {isExpired ? (
          <span>Closed · {totalVotes} vote{totalVotes === 1 ? "" : "s"}</span>
        ) : (
          <span>
            {expiresAt ? `Closes ${expiresAt.toLocaleString()}` : "No expiration"} · {totalVotes} vote{totalVotes === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}



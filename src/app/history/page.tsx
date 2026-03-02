"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Trash2, Clock } from "lucide-react";

interface ConversationItem {
  id: number;
  title: string;
  updatedAt: string;
  lastMessage: string;
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center lg:h-[calc(100dvh-2rem)]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Clock className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Loading conversations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Chat History</h1>
        <p className="mt-1 text-sm text-zinc-500">Your saved conversations with Mint AI</p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-900/40 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.06] bg-zinc-900">
            <MessageSquare className="h-7 w-7 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">No conversations yet</p>
          <p className="mt-1 text-xs text-zinc-600">Start chatting on the home page — your conversations will be saved here automatically.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 rounded-xl bg-[#c4f441] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#d4ff51]"
          >
            Start a chat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => router.push(`/?chat=${convo.id}`)}
              className="group flex w-full items-start gap-4 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-4 text-left transition-all hover:border-[#c4f441]/20 hover:bg-zinc-900/80"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500 transition-colors group-hover:bg-[#c4f441]/10 group-hover:text-[#c4f441]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-medium text-zinc-200">
                    {convo.title}
                  </h3>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {formatDate(convo.updatedAt)}
                  </span>
                </div>
                {convo.lastMessage && (
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {convo.lastMessage}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => handleDelete(e, convo.id)}
                className="shrink-0 rounded-lg p-2 text-zinc-700 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                title="Delete conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

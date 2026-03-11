"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export interface ConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
  lastMessage: string;
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const refresh = useCallback(async () => {
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
  }, []);

  // Re-fetch whenever the URL changes (catches new chats being auto-saved)
  useEffect(() => {
    refresh();
  }, [pathname, searchParams, refresh]);

  const deleteConversation = useCallback(async (id: number) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
  }, []);

  return { conversations, loading, refresh, deleteConversation };
}

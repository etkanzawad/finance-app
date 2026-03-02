"use client";

import { useState, useRef, useEffect, useCallback, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  Sparkles,
  Wallet,
  TrendingUp,
  ShoppingCart,
  PiggyBank,
  CircleDollarSign,
  CreditCard,
  RotateCcw,
  Tag,
  Paperclip,
  X,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { ChatUIRenderer } from "@/components/chat/ChatUIRenderer";
import type { UIComponent } from "@/lib/ui-components";

// ── Types ────────────────────────────────────────────────────
interface Attachment {
  type: "image" | "pdf";
  mimeType: string;
  data: string; // base64
  fileName: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ui_components?: UIComponent[];
  attachments?: Attachment[];
  timestamp: Date;
}

// ── File upload constants ────────────────────────────────────
const ALLOWED_TYPES: Record<string, "image" | "pdf"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/heic": "image",
  "application/pdf": "pdf",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ── Suggested prompts ────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: "Financial summary", prompt: "Give me a full summary of my finances — net position, safe to spend, debts, everything" },
  { icon: ShoppingCart, label: "My wishlist", prompt: "Show me my wishlist and tell me which items I can actually afford right now" },
  { icon: PiggyBank, label: "Savings progress", prompt: "How are my savings goals going? Show me the progress" },
  { icon: CreditCard, label: "BNPL plans", prompt: "What BNPL plans do I have active? How much do I owe?" },
  { icon: CircleDollarSign, label: "Recent spending", prompt: "Show me my recent transactions and spending breakdown this month" },
  { icon: Tag, label: "Clean up transactions", prompt: "Find all my uncategorized or 'Other' transactions from last month and suggest how to categorize them" },
];

// ── Markdown-lite renderer ───────────────────────────────────
function renderMessageContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${elements.length}`} className={listType === "ol" ? "list-decimal pl-5 space-y-1 my-2" : "list-disc pl-5 space-y-1 my-2"}>
          {listItems.map((item, i) => (
            <li key={i} className="text-zinc-300 text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={i} className="text-sm font-semibold text-zinc-200 mt-4 mb-1">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={i} className="text-base font-semibold text-zinc-100 mt-4 mb-2">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
    }
    // Unordered list
    else if (/^[-*•]\s/.test(line)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(line.replace(/^[-*•]\s+/, ""));
    }
    // Ordered list
    else if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(line.replace(/^\d+\.\s+/, ""));
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      flushList();
      elements.push(<hr key={i} className="border-white/[0.06] my-3" />);
    }
    // Empty line
    else if (line.trim() === "") {
      flushList();
    }
    // Regular paragraph
    else {
      flushList();
      elements.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold, then inline code, then italic
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Bold
      parts.push(<strong key={match.index} className="font-semibold text-zinc-100">{match[2]}</strong>);
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code key={match.index} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs font-mono text-[#c4f441]">
          {match[4]}
        </code>
      );
    } else if (match[5]) {
      // Italic
      parts.push(<em key={match.index} className="italic text-zinc-400">{match[6]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// ── Serialise messages for saving (strip base64 attachments to keep payload small) ──
function serializeForSave(msgs: Message[]) {
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
}

// ── Inner component (needs useSearchParams inside Suspense) ──
function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatId = searchParams.get("chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [accounts, setAccounts] = useState<{ id: number; name: string; type: string; balance: number; creditLimit: number | null }[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    }
  }, [input]);

  // Load conversation from URL param
  useEffect(() => {
    if (!chatId) {
      setConversationId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${chatId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setConversationId(data.id);
        const loadedMessages: Message[] = data.messages.map((m: { id?: string; role: string; content: string; timestamp?: string }) => ({
          id: m.id || crypto.randomUUID(),
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        setMessages(loadedMessages);
      } catch {
        // silently fail
      }
    })();
    return () => { cancelled = true; };
  }, [chatId]);

  // File upload handler
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!(file.type in ALLOWED_TYPES)) {
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        continue;
      }

      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      newAttachments.push({
        type: ALLOWED_TYPES[file.type],
        mimeType: file.type,
        data: base64,
        fileName: file.name,
      });
    }

    setPendingFiles((prev) => [...prev, ...newAttachments]);
  }, []);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  // Fetch accounts for welcome screen cards
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAccounts(data);
      } catch {
        // Silently ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-save conversation after assistant reply
  const saveConversation = useCallback(async (allMessages: Message[], currentConvoId: number | null) => {
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      const serialized = serializeForSave(allMessages);

      if (currentConvoId) {
        // Update existing conversation
        await fetch(`/api/conversations/${currentConvoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: serialized }),
        });
      } else {
        // Generate title and create new conversation
        let title = "New Chat";
        try {
          const titleRes = await fetch("/api/conversations/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: serialized }),
          });
          if (titleRes.ok) {
            const titleData = await titleRes.json();
            title = titleData.title;
          }
        } catch {
          // fall back to default title
        }

        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages: serialized }),
        });

        if (createRes.ok) {
          const created = await createRes.json();
          setConversationId(created.id);
          // Update URL without full navigation
          window.history.replaceState(null, "", `/?chat=${created.id}`);
        }
      }
    } catch {
      // silently fail
    } finally {
      savingRef.current = false;
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if ((!content.trim() && pendingFiles.length === 0) || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim() || (pendingFiles.length > 0 ? "Here's a file for you to look at." : ""),
        attachments: pendingFiles.length > 0 ? [...pendingFiles] : undefined,
        timestamp: new Date(),
      };

      const allMessages = [...messages, userMessage];
      setMessages(allMessages);
      setInput("");
      setPendingFiles([]);
      setIsLoading(true);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
              role: m.role,
              content: m.content,
              ...(m.attachments ? { attachments: m.attachments } : {}),
            })),
          }),
        });

        if (!res.ok) throw new Error("Failed to get response");

        const data = await res.json();

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          ui_components: data.ui_components,
          timestamp: new Date(),
        };

        const updatedMessages = [...allMessages, assistantMessage];
        setMessages(updatedMessages);

        // Auto-save after assistant reply
        saveConversation(updatedMessages, conversationId);
      } catch {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, pendingFiles, conversationId, saveConversation]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(null);
    router.push("/");
  };

  const isWelcome = messages.length === 0;

  return (
    <div
      className={`flex flex-col -m-4 lg:-m-8 h-[100dvh] lg:h-screen ${isDragging ? "ring-2 ring-[#c4f441]/30 ring-inset" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto relative">
        {isWelcome ? (
          /* ── Welcome Screen ── */
          <div className="flex h-full flex-col items-center justify-center px-4 py-6 overflow-y-auto">
            {/* Logo / Greeting */}
            <div className="relative mb-6">
              <div className="absolute -inset-4 rounded-full bg-[#c4f441]/[0.08] blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-900 shadow-2xl">
                <Sparkles className="h-9 w-9 text-[#c4f441]" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Hey, Etkan 👋
            </h1>
            <p className="mb-8 max-w-md text-center text-sm text-zinc-500">
              I&apos;m Mint, your AI finance assistant. Ask me anything about your money — accounts, spending, wishlist, savings, or whether you can afford something.
            </p>

            {/* Account Balance Cards */}
            {accounts.length > 0 && (
              <div className="mb-8 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                {accounts.map((acc) => {
                  const balanceDollars = acc.balance / 100;
                  const isDebt = acc.type === "credit_card";
                  return (
                    <div
                      key={acc.id}
                      className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {isDebt ? (
                          <CreditCard className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <Wallet className="h-4 w-4 text-zinc-500" />
                        )}
                        <span className="truncate text-xs font-medium text-zinc-500">
                          {acc.name}
                        </span>
                      </div>
                      <p className={`text-lg font-bold tracking-tight ${
                        isDebt && balanceDollars > 0
                          ? "text-red-400"
                          : balanceDollars < 0
                            ? "text-red-400"
                            : "text-white"
                      }`}>
                        {isDebt && balanceDollars > 0 && "-"}
                        ${Math.abs(balanceDollars).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {isDebt && acc.creditLimit && (
                        <p className="mt-0.5 text-[10px] text-zinc-600">
                          Limit: ${(acc.creditLimit / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Suggested Prompts */}
            <div className="hidden sm:grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((sp) => (
                <button
                  key={sp.label}
                  onClick={() => sendMessage(sp.prompt)}
                  className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 text-left transition-all hover:border-[#c4f441]/20 hover:bg-zinc-900 hover:shadow-lg hover:shadow-[#c4f441]/[0.03]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500 transition-colors group-hover:bg-[#c4f441]/10 group-hover:text-[#c4f441]">
                    <sp.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
                    {sp.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Chat Messages ── */
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-[#c4f441] px-4 py-3 text-sm text-black"
                      : "rounded-2xl rounded-bl-md border border-white/[0.06] bg-zinc-900/80 px-5 py-4"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div>
                      {msg.attachments?.map((att, i) => (
                        <div key={i} className="mb-2">
                          {att.type === "image" ? (
                            <img
                              src={`data:${att.mimeType};base64,${att.data}`}
                              alt={att.fileName}
                              className="max-w-[240px] rounded-lg"
                            />
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">{att.fileName}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <>
                      {renderMessageContent(msg.content)}
                      {msg.ui_components && msg.ui_components.length > 0 && (
                        <ChatUIRenderer
                          components={msg.ui_components}
                          onAction={(action) => {
                            if (action.type === "send_message") sendMessage(action.content);
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.06] bg-zinc-900/80 px-5 py-4">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#c4f441]/60 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#c4f441]/60 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#c4f441]/60 [animation-delay:300ms]" />
                  </div>
                  <span className="ml-2 text-xs text-zinc-600">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input Bar ── */}
      <div className="shrink-0 border-t border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Pending file previews */}
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className="group relative rounded-lg border border-white/[0.08] bg-zinc-900/60 p-1"
                >
                  {file.type === "image" ? (
                    <img
                      src={`data:${file.mimeType};base64,${file.data}`}
                      alt={file.fileName}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded bg-red-500/10 text-red-400">
                      <FileText className="h-5 w-5" />
                      <span className="mt-1 text-[8px] font-mono">PDF</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-white/[0.1] bg-zinc-800 p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <p className="mt-0.5 w-16 truncate text-[9px] text-zinc-600">
                    {file.fileName}
                  </p>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* New chat / clear button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
                title="New chat"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            {/* Attach file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400 disabled:opacity-30"
              title="Attach receipt or bill"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Input + send button */}
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances..."
                rows={1}
                className="w-full overflow-hidden resize-none rounded-2xl border border-white/[0.08] bg-zinc-900/60 py-3 pl-4 pr-12 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#c4f441]/30 focus:outline-none focus:ring-1 focus:ring-[#c4f441]/20"
                disabled={isLoading}
              />

              {/* Send button — absolutely pinned inside the textarea */}
              <button
                type="submit"
                disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
                className="absolute right-2 bottom-2 rounded-xl bg-[#c4f441] p-2 text-black transition-all hover:bg-[#d4ff51] disabled:opacity-30 disabled:hover:bg-[#c4f441]"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>

          <p className="mt-2 text-center text-[10px] text-zinc-700">
            Mint AI can make mistakes. Always double-check important financial decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page export (Suspense boundary for useSearchParams) ──────
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

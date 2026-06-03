"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Ellipsis, Loader2, MessageSquarePlus, Pencil, SendHorizontal, Sparkles, Square, Trash2, User2 } from "lucide-react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, truncate } from "@/lib/utils";
import type { ChatMessageRecord, ChatSource, Profile } from "@/types";

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

type MenuPosition = {
  top: number;
  left: number;
};

type DeleteTarget = {
  id: string;
  title: string;
};

type Message = ChatMessageRecord & {
  pending?: boolean;
};

type StreamEvent =
  | { type: "meta"; sessionId: string; sessionTitle: string; sources: ChatSource[] }
  | { type: "delta"; delta: string }
  | { type: "complete"; sessionId: string; sessionTitle: string; message: ChatMessageRecord }
  | { type: "error"; error: string; sessionId?: string; sessionTitle?: string }
  | { type: "aborted" };


const COLLAPSE_THRESHOLD = 360;

function normalizeAssistantContent(content: string) {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, "\n$1\n")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1 / $2)")
    .replace(/\r\n/g, "\n")
    .trim();
}

function isFormulaBlock(block: string) {
  const compact = block.replace(/\s+/g, " ").trim();
  return (
    /[=×÷/+*-]/.test(compact) &&
    (compact.includes("P =") ||
      compact.includes("DP") ||
      compact.includes("Formula") ||
      /[A-Za-z]\s*=\s*/.test(compact) ||
      compact.includes("§"))
  );
}

function renderAssistantContent(content: string) {
  const normalized = normalizeAssistantContent(content);
  const blocks = normalized.split(/\n\s*\n/).filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return null;
    }

    const bulletLines = lines.filter((line) => /^-\s+/.test(line));
    if (bulletLines.length === lines.length) {
      return (
        <ul key={`block-${index}`} className="space-y-2 pl-5 text-[15px] leading-8 text-foreground">
          {bulletLines.map((line, lineIndex) => (
            <li key={`bullet-${index}-${lineIndex}`}>{line.replace(/^-\s+/, "")}</li>
          ))}
        </ul>
      );
    }

    if (isFormulaBlock(block)) {
      return (
        <pre
          key={`block-${index}`}
          className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/45 px-4 py-3 font-mono text-[14px] leading-7 text-foreground"
        >
          {lines.join("\n")}
        </pre>
      );
    }

    return (
      <p key={`block-${index}`} className="whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground [overflow-wrap:anywhere]">
        {lines.join("\n")}
      </p>
    );
  });
}

export function ChatWorkspace({
  initialSessions,
  initialMessages,
  profile,
  responseStyle,
  systemPrompt,
  allowCitations,
  disabled = false
}: {
  initialSessions: Session[];
  initialMessages: Message[];
  profile: Pick<Profile, "full_name" | "email" | "role">;
  responseStyle: string;
  systemPrompt: string;
  allowCitations: boolean;
  disabled?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessions[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sessionLabel = useMemo(() => {
    if (!selectedSessionId) return "New conversation";
    return sessions.find((session) => session.id === selectedSessionId)?.title ?? "Conversation";
  }, [selectedSessionId, sessions]);

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function copyMessage(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1600);
      toast.success("Copied message.");
    } catch {
      toast.error("Could not copy the message.");
    }
  }

  function toggleExpanded(messageId: string) {
    setExpandedMessages((current) => ({ ...current, [messageId]: !current[messageId] }));
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 176);
    textarea.style.height = `${Math.max(nextHeight, 32)}px`;
  }, [prompt]);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: loading ? "smooth" : "auto"
    });
  }, [messages, selectedSessionId, loading]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuSessionId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function focusComposer() {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  async function sendMessage() {
    if (!prompt.trim() || disabled) return;

    const content = prompt.trim();
    const optimisticUserMessage: Message = {
      id: crypto.randomUUID(),
      session_id: selectedSessionId ?? "pending",
      role: "user",
      content,
      sources: null,
      created_at: new Date().toISOString()
    };
    const optimisticAssistantId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      optimisticUserMessage,
      {
        id: optimisticAssistantId,
        session_id: selectedSessionId ?? "pending",
        role: "assistant",
        content: "",
        sources: null,
        created_at: new Date().toISOString(),
        pending: true
      }
    ]);
    setPrompt("");
    focusComposer();
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          message: content
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to send message.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalMessage: ChatMessageRecord | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "meta") {
            setSelectedSessionId(event.sessionId);
            setSessions((current) => {
              const existing = current.find((item) => item.id === event.sessionId);
              const next = { id: event.sessionId, title: event.sessionTitle, updated_at: new Date().toISOString() };
              return existing ? [next, ...current.filter((item) => item.id !== event.sessionId)] : [next, ...current];
            });
            setMessages((current) =>
              current.map((item) =>
                item.id === optimisticUserMessage.id || item.id === optimisticAssistantId
                  ? { ...item, session_id: event.sessionId }
                  : item
              )
            );
          }

          if (event.type === "delta") {
            setMessages((current) =>
              current.map((item) =>
                item.id === optimisticAssistantId ? { ...item, content: `${item.content}${event.delta}` } : item
              )
            );
          }

          if (event.type === "complete") {
            finalMessage = event.message;
            setSelectedSessionId(event.sessionId);
            setSessions((current) => {
              const next = { id: event.sessionId, title: event.sessionTitle, updated_at: new Date().toISOString() };
              return [next, ...current.filter((item) => item.id !== event.sessionId)];
            });
            setMessages((current) => [
              ...current.filter((item) => item.id !== optimisticAssistantId && item.id !== optimisticUserMessage.id),
              { ...optimisticUserMessage, session_id: event.sessionId },
              event.message
            ]);
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }

          if (event.type === "aborted") {
            toast.message("Generation stopped.");
          }
        }
      }

      if (!finalMessage && !controller.signal.aborted) {
        throw new Error("The response ended before completion. You can retry the last message.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        toast.message("Response stopped. Partial text was not saved.");
      } else {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
      setPrompt(content);
      setMessages((current) =>
        current.map((item) => (item.id === optimisticAssistantId ? { ...item, pending: false } : item))
      );
    } finally {
      abortRef.current = null;
      setLoading(false);
      focusComposer();
    }
  }

  async function loadSession(sessionId: string) {
    if (loading) return;
    setSelectedSessionId(sessionId);
    setLoading(true);

    try {
      const response = await fetch(`/api/chat?sessionId=${sessionId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load conversation.");
      }

      setMessages((payload.messages ?? []) as Message[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion(text: string) {
    setPrompt(text);
  }

  function beginRename(session: Session) {
    setRenamingSessionId(session.id);
    setRenameValue(session.title);
    setOpenMenuSessionId(null);
    setMenuPosition(null);
  }

  async function saveRename(sessionId: string) {
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      toast.error("Title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: nextTitle })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to rename conversation.");
      }

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, title: payload.session.title, updated_at: payload.session.updated_at } : session
        )
      );
      setRenamingSessionId(null);
      setRenameValue("");
      toast.success("Conversation renamed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename conversation.");
    }
  }

  function cancelRename() {
    setRenamingSessionId(null);
    setRenameValue("");
  }

  async function deleteSession(sessionId: string) {
    try {
      const response = await fetch(`/api/chat/${sessionId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to delete conversation.");
      }

      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(remainingSessions);
      setOpenMenuSessionId(null);
      setMenuPosition(null);
      setDeleteTarget(null);

      if (selectedSessionId === sessionId) {
        const nextSession = remainingSessions[0] ?? null;
        setSelectedSessionId(nextSession?.id ?? null);
        if (nextSession) {
          await loadSession(nextSession.id);
        } else {
          setMessages([]);
        }
      }

      toast.success("Conversation deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete conversation.");
    }
  }

  function openDeleteDialog(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    setOpenMenuSessionId(null);
    setMenuPosition(null);
    setDeleteTarget({
      id: session.id,
      title: session.title
    });
  }

  function toggleSessionMenu(sessionId: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (openMenuSessionId === sessionId) {
      setOpenMenuSessionId(null);
      setMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setOpenMenuSessionId(sessionId);
    setMenuPosition({
      top: rect.top,
      left: rect.right + 8
    });
  }

  return (
    <div className="grid h-full min-h-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="relative z-30 hidden min-h-0 overflow-visible border-r border-white/8 bg-[linear-gradient(180deg,rgba(14,20,31,0.98),rgba(9,14,24,0.98))] text-white lg:flex lg:flex-col">
        <div className="p-4">
          <Button
            type="button"
            className="w-full justify-start rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
            disabled={loading}
            onClick={() => {
              setSelectedSessionId(null);
              setMessages([]);
            }}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New chat
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-visible px-3 pb-4">
          {sessions.length ? (
            sessions.map((session) => (
              <div
                key={session.id}
                ref={openMenuSessionId === session.id ? menuRef : null}
                className={`group relative rounded-2xl transition ${
                  selectedSessionId === session.id ? "bg-white/10" : "hover:bg-white/6"
                } ${loading ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2 px-4 py-3">
                  {renamingSessionId === session.id ? (
                    <div className="min-w-0 flex-1">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveRename(session.id);
                          }
                          if (event.key === "Escape") {
                            cancelRename();
                          }
                        }}
                        onBlur={() => {
                          const currentTitle = sessions.find((item) => item.id === session.id)?.title ?? "";
                          if (!renameValue.trim() || renameValue.trim() === currentTitle) {
                            cancelRename();
                            return;
                          }
                          void saveRename(session.id);
                        }}
                        autoFocus
                        className="w-full bg-transparent px-0 py-0 text-sm font-medium text-white outline-none ring-0 placeholder:text-white/35"
                      />
                      <p className="mt-1 text-xs text-white/35">{formatDate(session.updated_at)}</p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => loadSession(session.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-white">{truncate(session.title, 26)}</p>
                        <p className="mt-1 text-xs text-white/45">{formatDate(session.updated_at)}</p>
                      </button>
                      <button
                        type="button"
                        aria-label="Conversation options"
                        onClick={(event) => toggleSessionMenu(session.id, event)}
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white ${
                          openMenuSessionId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-5 text-sm leading-6 text-white/55">
              Start your first conversation. TIMS AI will answer only from uploaded documents.
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
        
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-3.5">
            
            
            <div className="pt-2.5">
              <p className="truncate font-medium text-white">{profile.full_name ?? profile.email}</p>
              <p className="truncate text-sm text-white/60">{profile.email}</p>
            </div>
            {profile.role === "admin" ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="mt-3 h-9 w-full justify-start rounded-xl border-white/12 bg-white/5 px-3 text-sm text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/admin">Open Admin Panel</Link>
                </Button>

              </>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <ThemeToggle className="h-9 w-9 shrink-0 rounded-xl border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white" />
              <SignOutButton className="h-9 rounded-xl border-white/12 bg-white/5 px-3 text-sm text-white hover:bg-white/10 hover:text-white" />
            </div>
            
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border/50 px-5 py-4 lg:px-8">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">TIMS AI Chat</p>
             
            </div>
            {/* <div className="text-right text-xs text-muted-foreground">
              <p>{responseStyle} mode</p>
              <p>{allowCitations ? "Citations on" : "Citations hidden"}</p>
            </div> */}
          </div>
        </div>

        <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto mb-6 flex w-full max-w-4xl flex-wrap items-center gap-3 lg:hidden">
            <Button
              type="button"
              className="rounded-2xl"
              disabled={loading}
              onClick={() => {
                setSelectedSessionId(null);
                setMessages([]);
              }}
            >
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              New chat
            </Button>
            {sessions.slice(0, 3).map((session) => (
              <button
                key={session.id}
                type="button"
                disabled={loading}
                onClick={() => loadSession(session.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedSessionId === session.id
                    ? "border-primary/35 bg-primary/10 text-foreground"
                    : "border-border/70 bg-background/55 text-muted-foreground hover:bg-background"
                }`}
              >
                {truncate(session.title, 22)}
              </button>
            ))}
          </div>

          {messages.length ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`group flex min-w-0 ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`flex items-start gap-3 ${
                      message.role === "assistant" ? "max-w-[85%]" : "max-w-[78%]"
                    } ${
                      message.role === "assistant" ? "" : "flex-row-reverse"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => copyMessage(message.id, message.content)}
                      aria-label={copiedMessageId === message.id ? "Copied" : "Copy message"}
                      title={copiedMessageId === message.id ? "Copied" : "Copy"}
                      className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/80 hover:text-foreground ${
                        copiedMessageId === message.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      } ${message.role === "assistant" ? "order-3" : "order-1"}`}
                    >
                      {copiedMessageId === message.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    {(() => {
                      const isUserMessage = message.role === "user";
                      const isExpanded = expandedMessages[message.id] ?? false;
                      const shouldCollapse = isUserMessage && message.content.length > COLLAPSE_THRESHOLD;

                      return (
                        <>
                    <span
                      className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        message.role === "assistant"
                          ? "bg-primary/10 text-primary"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
                    </span>
                    <div
                      className={`min-w-0 flex-1 ${
                        message.role === "assistant"
                          ? ""
                          : "rounded-[22px] border border-primary/15 bg-primary/8 px-4 py-3 shadow-sm"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <div className={`space-y-4 ${shouldCollapse && !isExpanded ? "line-clamp-5" : ""}`}>
                          {renderAssistantContent(message.content || (message.pending ? "Thinking..." : ""))}
                        </div>
                      ) : (
                        <p
                          className={`whitespace-pre-wrap break-words text-[15px] leading-8 text-foreground [overflow-wrap:anywhere] ${
                            shouldCollapse && !isExpanded ? "line-clamp-5" : ""
                          }`}
                        >
                          {message.content || (message.pending ? "Thinking..." : "")}
                        </p>
                      )}
                      {message.pending ? <p className="mt-3 text-xs text-muted-foreground">Streaming response...</p> : null}
                      <div
                        className={`mt-3 flex items-center gap-3 text-sm ${
                          message.role === "assistant" ? "" : "justify-end"
                        }`}
                      >
                        {shouldCollapse ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(message.id)}
                            className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
                          >
                            <span>{isExpanded ? "See less" : "See more"}</span>
                            <ChevronDown className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center py-10 text-center">
              <div className="inline-flex rounded-3xl border border-border/60 bg-background/70 p-5 text-primary shadow-sm">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mt-6 font-[family-name:var(--font-heading)] text-5xl font-semibold tracking-tight lg:text-6xl">
                How can I help you today?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
                Ask questions against the uploaded knowledge base. TIMS AI will stay grounded in documents provided and tell you when the source material does not support an answer.
              </p>
              
              <p className="mt-8 text-xs text-muted-foreground">
                Responses stay inside your document set. Verify important decisions before acting.
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/50 px-4 pb-3 pt-3 lg:px-8">
          <div className="mx-auto w-full max-w-4xl">
            <div className="rounded-[26px] border border-border/70 bg-background/92 px-4 py-2 shadow-sm backdrop-blur">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={prompt}
                    disabled={disabled}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!loading && !disabled && prompt.trim()) {
                          void sendMessage();
                        }
                      }
                    }}
                    placeholder={disabled ? "Finish environment setup to enable chat." : "Send a message"}
                    rows={1}
                    className="max-h-44 min-h-[32px] w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-base leading-6 focus:border-0"
                  />
                </div>
                {loading ? (
                  <Button type="button" variant="outline" className="h-10 shrink-0 rounded-2xl px-4" onClick={stopStreaming}>
                    <Square className="h-4 w-4" />
                    <span className="ml-2">Stop</span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-10 shrink-0 rounded-2xl px-4"
                  onClick={sendMessage}
                  disabled={disabled || loading || !prompt.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  <span className="ml-2">Send</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {openMenuSessionId && menuPosition && renamingSessionId !== openMenuSessionId ? (
        <div
          ref={menuRef}
          className="fixed z-[80] w-32 rounded-[18px] border border-white/10 bg-[#383838] p-1.5 shadow-2xl shadow-black/40"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
        >
          <button
            type="button"
            onClick={() => {
              const session = sessions.find((item) => item.id === openMenuSessionId);
              if (session) {
                beginRename(session);
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] text-white transition hover:bg-white/8"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Rename</span>
          </button>
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            onClick={() => openDeleteDialog(openMenuSessionId)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] text-[#ff6b6b] transition hover:bg-white/8"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-[22px] border border-white/8 bg-[#262626] px-6 py-6 text-white shadow-[0_24px_72px_rgba(0,0,0,0.42)]">
            <h3 className="text-[18px] font-medium tracking-tight text-white">Delete chat?</h3>
            <p className="mt-6 text-[14px] leading-7 text-white/92">
              This will delete <span className="font-semibold text-white">{deleteTarget.title}</span>.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-white/62">
              This action cannot be undone.
            </p>
            <div className="mt-7 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-white/10 bg-black px-5 text-[15px] font-medium text-white hover:bg-black/80 hover:text-white"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full bg-[#ef4444] px-5 text-[15px] font-medium text-white hover:bg-[#dc2626]"
                onClick={() => void deleteSession(deleteTarget.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

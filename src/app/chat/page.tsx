"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Bot,
  Clock,
  Loader2,
  Sparkles,
  History,
  ChevronRight,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

interface SessionGroup {
  id: string;
  label: string;
  date: string;
  messageCount: number;
  firstMessage: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusDot(status: string): string {
  switch (status) {
    case "online":
      return "bg-emerald-400";
    case "busy":
      return "bg-amber-400";
    case "error":
      return "bg-red-400";
    default:
      return "bg-zinc-500";
  }
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function groupSessionMessages(messages: ChatMessage[]): SessionGroup[] {
  if (messages.length === 0) return [];

  const groups: SessionGroup[] = [];
  let currentDate = "";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgDate = new Date(msg.timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({
        id: `group-${i}`,
        label: msgDate,
        date: msg.timestamp,
        messageCount: 1,
        firstMessage:
          msg.content.length > 60 ? msg.content.slice(0, 60) + "..." : msg.content,
      });
    } else if (groups.length > 0) {
      groups[groups.length - 1].messageCount++;
    }
  }

  return groups;
}

// ─── TypingIndicator ─────────────────────────────────────────────────────────

function TypingIndicator({ agentEmoji }: { agentEmoji: string }) {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-end gap-2.5 max-w-[75%]">
        <div className="shrink-0 w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">
          {agentEmoji}
        </div>
        <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span
              className="block h-2 w-2 rounded-full bg-zinc-400 animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "1.2s" }}
            />
            <span
              className="block h-2 w-2 rounded-full bg-zinc-400 animate-bounce"
              style={{ animationDelay: "150ms", animationDuration: "1.2s" }}
            />
            <span
              className="block h-2 w-2 rounded-full bg-zinc-400 animate-bounce"
              style={{ animationDelay: "300ms", animationDuration: "1.2s" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  agentEmoji,
  agentName,
  showAgentInfo,
}: {
  message: ChatMessage;
  agentEmoji: string;
  agentName: string;
  showAgentInfo: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex animate-fade-up",
        isUser ? "justify-end" : "justify-start"
      )}
      style={{ animationDuration: "0.3s" }}
    >
      {isUser ? (
        <div className="flex items-end gap-2.5 max-w-[75%]">
          <div className="flex flex-col items-end gap-1">
            <div className="bg-gradient-to-br from-indigo-500/90 to-violet-600/90 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-lg shadow-indigo-500/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span className="text-[10px] text-zinc-600 px-1 tabular-nums">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2.5 max-w-[75%]">
          {showAgentInfo ? (
            <div className="shrink-0 w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">
              {agentEmoji}
            </div>
          ) : (
            <div className="w-7 shrink-0" />
          )}
          <div className="flex flex-col gap-1">
            {showAgentInfo && (
              <span className="text-[11px] font-medium text-zinc-500 ml-1">
                {agentName}
              </span>
            )}
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-2.5">
              <p className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
            <span className="text-[10px] text-zinc-600 px-1 tabular-nums">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

function EmptyState({ agentName, agentEmoji }: { agentName: string; agentEmoji: string }) {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-4 max-w-sm">
        <div className="relative inline-flex">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-white/[0.06] flex items-center justify-center text-3xl">
            {agentEmoji}
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <MessageSquare className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white">
            Start a conversation with {agentName}
          </h3>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Send a message to begin interacting with this agent.
            Session history will appear here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {["What can you do?", "Show me your status", "Run a task"].map((suggestion) => (
            <span
              key={suggestion}
              className="px-3 py-1.5 text-xs text-zinc-400 rounded-full border border-white/[0.06] bg-white/[0.02] cursor-default"
            >
              {suggestion}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── NoAgentState ────────────────────────────────────────────────────────────

function NoAgentState() {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-4 max-w-sm">
        <div className="h-16 w-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto">
          <Bot className="h-8 w-8 text-zinc-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white">No agents available</h3>
          <p className="text-sm text-zinc-500 leading-relaxed">
            No agents were found in your OpenClaw configuration.
            Make sure agents are set up in{" "}
            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-400">
              ~/.openclaw/
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SessionSidebar ──────────────────────────────────────────────────────────

function SessionSidebar({
  open,
  onToggle,
  agents,
  selectedAgent,
  onSelectAgent,
  sessionGroups,
  loadingHistory,
}: {
  open: boolean;
  onToggle: () => void;
  agents: Array<{ id: string; name: string; emoji: string; status: string; model: string }>;
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
  sessionGroups: SessionGroup[];
  loadingHistory: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 h-full border-r border-white/[0.06] bg-black/20 transition-all duration-300 flex flex-col overflow-hidden",
        open ? "w-72" : "w-0"
      )}
    >
      {/* Sidebar header */}
      <div className="shrink-0 flex items-center gap-2 p-4 border-b border-white/[0.06]">
        <History className="h-4 w-4 text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-300">Sessions</span>
      </div>

      {/* Agent quick-select list */}
      <div className="shrink-0 border-b border-white/[0.06]">
        <ScrollArea className="max-h-[240px]">
          <div className="p-2 space-y-0.5">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => onSelectAgent(a.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-200",
                  selectedAgent === a.id
                    ? "bg-white/[0.06] border border-white/[0.08]"
                    : "border border-transparent hover:bg-white/[0.03]"
                )}
              >
                <div className="relative shrink-0">
                  <span className="text-lg block">{a.emoji}</span>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900",
                      statusDot(a.status),
                      a.status === "online" && "animate-live-pulse"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{a.name}</p>
                  <p className="text-[10px] text-zinc-600 font-mono truncate">{a.model}</p>
                </div>
                {selectedAgent === a.id && (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Session history groups */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {loadingHistory ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div
                    className="h-3 rounded skeleton-shimmer"
                    style={{ width: `${50 + Math.random() * 30}%` }}
                  />
                  <div
                    className="h-2.5 rounded skeleton-shimmer"
                    style={{ width: `${60 + Math.random() * 30}%` }}
                  />
                </div>
              ))}
            </div>
          ) : sessionGroups.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-5 w-5 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-600">No session history</p>
            </div>
          ) : (
            sessionGroups.map((group, i) => (
              <div
                key={group.id}
                className="px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default animate-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[9px] bg-zinc-800/80 text-zinc-500 border-none"
                  >
                    {group.messageCount}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-2">
                  {group.firstMessage}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { agents, hydrated } = useStore();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const loadedAgents = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select first agent once hydrated
  useEffect(() => {
    if (hydrated && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id);
    }
  }, [hydrated, agents, selectedAgent]);

  // Load session history from API when an agent is selected
  useEffect(() => {
    if (!selectedAgent || loadedAgents.current.has(selectedAgent)) return;

    let cancelled = false;
    setLoadingHistory(true);

    fetch(`/api/sessions?agentId=${encodeURIComponent(selectedAgent)}&limit=50`)
      .then((res) => (res.ok ? res.json() : []))
      .then(
        (
          entries: Array<{
            timestamp: string;
            role: string;
            content: string;
          }>
        ) => {
          if (cancelled) return;
          loadedAgents.current.add(selectedAgent);

          const msgs: ChatMessage[] = entries
            .filter((e) => e.content && e.content.trim().length > 0)
            .reverse()
            .map((e, i) => ({
              id: `session-${selectedAgent}-${i}`,
              role: e.role === "user" ? ("user" as const) : ("agent" as const),
              content: e.content,
              timestamp: e.timestamp,
            }));

          setHistories((prev) => ({
            ...prev,
            [selectedAgent]: msgs,
          }));
        }
      )
      .catch(() => {
        if (!cancelled) {
          loadedAgents.current.add(selectedAgent);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAgent]);

  // Auto-scroll to bottom on new messages or typing indicator
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [histories, isTyping, selectedAgent, scrollToBottom]);

  const messages = histories[selectedAgent] ?? [];
  const agent = agents.find((a) => a.id === selectedAgent);
  const sessionGroups = groupSessionMessages(messages);

  function sendMessage() {
    const text = inputValue.trim();
    if (!text || !selectedAgent) return;

    const userMsg: ChatMessage = {
      id: "m-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setHistories((prev) => ({
      ...prev,
      [selectedAgent]: [...(prev[selectedAgent] ?? []), userMsg],
    }));
    setInputValue("");
    setIsTyping(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Simulate agent response
    setTimeout(() => {
      const agentReply: ChatMessage = {
        id: "m-" + (Date.now() + 1),
        role: "agent",
        content:
          "I have received your message and will process it now. Stand by...",
        timestamp: new Date().toISOString(),
      };

      setHistories((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] ?? []), agentReply],
      }));
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  // ─── Loading state ───────────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="h-[calc(100vh-88px)] -m-6 flex items-center justify-center">
        <div className="flex items-center gap-3 animate-pulse">
          <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-88px)] -m-6 flex overflow-hidden">
      {/* Session Sidebar */}
      <SessionSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        sessionGroups={sessionGroups}
        loadingHistory={loadingHistory}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Chat Header ─────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-black/10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-zinc-400 hover:text-zinc-200 shrink-0"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-5 w-px bg-white/[0.06]" />

          {/* Agent selector */}
          {agents.length > 0 ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-auto max-w-[260px] bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] transition-colors">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>{a.emoji}</span>
                        <span>{a.name}</span>
                        <Circle
                          className={cn(
                            "h-2 w-2 fill-current",
                            a.status === "online"
                              ? "text-emerald-400"
                              : a.status === "busy"
                              ? "text-amber-400"
                              : a.status === "error"
                              ? "text-red-400"
                              : "text-zinc-500"
                          )}
                        />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {agent && (
                <div className="hidden sm:flex items-center gap-2 min-w-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-medium border",
                      agent.status === "online"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : agent.status === "busy"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        : agent.status === "error"
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                    )}
                  >
                    {agent.status}
                  </Badge>
                  <span className="text-[11px] text-zinc-600 font-mono truncate">
                    {agent.model}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm text-zinc-500">No agents configured</span>
          )}

          {/* Message count */}
          {messages.length > 0 && (
            <span className="hidden sm:block text-[11px] text-zinc-600 shrink-0 tabular-nums">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Messages Area ───────────────────────────────────────────────── */}
        {agents.length === 0 ? (
          <NoAgentState />
        ) : !selectedAgent ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-zinc-500">Select an agent to begin</p>
          </div>
        ) : loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
              <p className="text-sm text-zinc-500">Loading session history...</p>
            </div>
          </div>
        ) : messages.length === 0 && !isTyping ? (
          <EmptyState
            agentName={agent?.name ?? "this agent"}
            agentEmoji={agent?.emoji ?? "?"}
          />
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
              {/* Date separator for first message */}
              {messages.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-white/[0.04]" />
                  <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                    {new Date(messages[0].timestamp).toLocaleDateString([], {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.04]" />
                </div>
              )}

              {messages.map((msg, i) => {
                // Show agent info (avatar + name) on agent messages that follow a user message
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const showAgentInfo =
                  msg.role === "agent" &&
                  (i === 0 || prevMsg?.role !== "agent");

                // Insert date separator between messages on different days
                let dateSep: React.ReactNode = null;
                if (i > 0) {
                  const prevDate = new Date(messages[i - 1].timestamp).toDateString();
                  const curDate = new Date(msg.timestamp).toDateString();
                  if (prevDate !== curDate) {
                    dateSep = (
                      <div className="flex items-center gap-3 py-2" key={`sep-${i}`}>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                        <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                          {new Date(msg.timestamp).toLocaleDateString([], {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                      </div>
                    );
                  }
                }

                return (
                  <div key={msg.id}>
                    {dateSep}
                    <MessageBubble
                      message={msg}
                      agentEmoji={agent?.emoji ?? "?"}
                      agentName={agent?.name ?? "Agent"}
                      showAgentInfo={showAgentInfo}
                    />
                  </div>
                );
              })}

              {isTyping && (
                <TypingIndicator agentEmoji={agent?.emoji ?? "?"} />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* ── Input Area ──────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-white/[0.06] bg-black/10 p-4">
          <div className="max-w-3xl mx-auto">
            <div
              className={cn(
                "flex items-end gap-2 rounded-xl border bg-white/[0.02] px-3 py-2 transition-all duration-200",
                inputRef.current === document.activeElement
                  ? "border-indigo-500/40 ring-1 ring-indigo-500/20 bg-white/[0.03]"
                  : "border-white/[0.08] hover:border-white/[0.12]"
              )}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Force re-render for border style
                  setInputValue((v) => v);
                }}
                onBlur={() => {
                  setInputValue((v) => v);
                }}
                placeholder={
                  agent
                    ? `Message ${agent.name}...`
                    : "Select an agent first"
                }
                disabled={!selectedAgent || isTyping}
                rows={1}
                className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none min-h-[24px] max-h-[160px] py-1 leading-relaxed disabled:opacity-50"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={sendMessage}
                      disabled={!selectedAgent || !inputValue.trim() || isTyping}
                      size="icon-sm"
                      className={cn(
                        "shrink-0 rounded-lg transition-all duration-200",
                        inputValue.trim()
                          ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
                          : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      {isTyping ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isTyping ? "Agent is responding..." : "Send message"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-zinc-700 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

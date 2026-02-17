"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const { agents, hydrated } = useStore();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const loadedAgents = useRef<Set<string>>(new Set());

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
      .then((entries: Array<{ timestamp: string; role: string; content: string }>) => {
        if (cancelled) return;
        loadedAgents.current.add(selectedAgent);

        // Convert session entries to chat messages (oldest first for display)
        const msgs: ChatMessage[] = entries
          .filter((e) => e.content && e.content.trim().length > 0)
          .reverse()
          .map((e, i) => ({
            id: `session-${selectedAgent}-${i}`,
            role: e.role === "user" ? "user" as const : "agent" as const,
            content: e.content,
            timestamp: e.timestamp,
          }));

        setHistories((prev) => ({
          ...prev,
          [selectedAgent]: msgs,
        }));
      })
      .catch(() => {
        if (!cancelled) {
          loadedAgents.current.add(selectedAgent);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => { cancelled = true; };
  }, [selectedAgent]);

  const messages = histories[selectedAgent] ?? [];
  const agent    = agents.find((a) => a.id === selectedAgent);

  function sendMessage() {
    const text = inputValue.trim();
    if (!text || !selectedAgent) return;

    const userMsg: ChatMessage = {
      id: "m-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const agentReply: ChatMessage = {
      id: "m-" + (Date.now() + 1),
      role: "agent",
      content: "I have received your message and will process it now. Stand by...",
      timestamp: new Date(Date.now() + 800).toISOString(),
    };

    setHistories((prev) => ({
      ...prev,
      [selectedAgent]: [...(prev[selectedAgent] ?? []), userMsg, agentReply],
    }));
    setInputValue("");
  }

  if (!hydrated) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Agent List */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold">Agents</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground px-3 py-4">No agents found.</p>
            )}
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAgent(a.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                  selectedAgent === a.id ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <span className="text-xl">{a.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.model}</p>
                </div>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    a.status === "online" ? "bg-emerald-500" :
                    a.status === "busy"   ? "bg-amber-500"   :
                    a.status === "error"  ? "bg-red-500"     : "bg-zinc-500"
                  )}
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          {agent ? (
            <>
              <span className="text-2xl">{agent.emoji}</span>
              <div>
                <p className="font-semibold">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.model}</p>
              </div>
              <Badge variant={agent.status === "online" ? "default" : "secondary"} className="ml-auto">
                {agent.status}
              </Badge>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Select an agent to start chatting</p>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {loadingHistory && (
              <p className="text-muted-foreground text-sm text-center py-4 animate-pulse">
                Loading session history...
              </p>
            )}
            {!loadingHistory && messages.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-12">
                No messages yet. Send a message to {agent?.name ?? "this agent"}.
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  <p>{msg.content}</p>
                  <p className={cn(
                    "text-[10px] mt-1 opacity-70",
                    msg.role === "user" ? "text-right" : "text-left"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={agent ? "Message " + agent.name + "..." : "Select an agent first"}
              disabled={!selectedAgent}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!selectedAgent || !inputValue.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

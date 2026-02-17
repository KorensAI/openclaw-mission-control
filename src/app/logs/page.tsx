"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { LogEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";

type LevelFilter = "all" | LogEntry["level"];

function levelBadgeVariant(level: LogEntry["level"]): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "error": return "destructive";
    case "warn":  return "secondary";
    case "debug": return "outline";
    default:      return "default";
  }
}

function levelTextColor(level: LogEntry["level"]): string {
  switch (level) {
    case "error": return "text-red-400";
    case "warn":  return "text-amber-400";
    case "debug": return "text-purple-400";
    default:      return "text-emerald-400";
  }
}

export default function LogsPage() {
  const { logs, clearLogs, agents, hydrated } = useStore();
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll]   = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter((log) => {
    const levelOk = levelFilter === "all" || log.level === levelFilter;
    const agentOk = agentFilter === "all"  || log.agentId === agentFilter;
    return levelOk && agentOk;
  });

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  if (!hydrated) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="warn">Warn</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
            <TabsTrigger value="debug">Debug</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={autoScroll ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            Auto-scroll
          </Button>

          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-zinc-950">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-1 font-mono text-xs">
            {filtered.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No log entries matching the current filter.</p>
            )}
            {filtered.map((log) => {
              const agent = agents.find((a) => a.id === log.agentId);
              return (
                <div key={log.id} className="flex items-start gap-3 py-0.5 hover:bg-white/5 rounded px-1">
                  <span className="text-zinc-500 select-none whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <Badge variant={levelBadgeVariant(log.level)} className="text-[10px] py-0 px-1.5 shrink-0">
                    {log.level.toUpperCase()}
                  </Badge>
                  {agent && (
                    <span className="text-zinc-400 shrink-0">{agent.emoji} {agent.name}</span>
                  )}
                  <span className={"flex-1 " + levelTextColor(log.level)}>{log.message}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} entries shown</p>
    </div>
  );
}

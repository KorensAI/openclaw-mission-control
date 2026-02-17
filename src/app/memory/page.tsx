"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { MemoryEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";

type MemoryTypeFilter = "all" | MemoryEntry["type"];

function typeBadgeVariant(type: MemoryEntry["type"]): "default" | "secondary" | "outline" {
  switch (type) {
    case "daily":      return "default";
    case "long_term":  return "secondary";
    default:           return "outline";
  }
}

function typeLabel(type: MemoryEntry["type"]): string {
  switch (type) {
    case "daily":      return "Daily";
    case "long_term":  return "Long-term";
    case "workspace":  return "Workspace";
  }
}

export default function MemoryPage() {
  const { memories, agents, setMemories } = useStore();
  const [typeFilter, setTypeFilter]   = useState<MemoryTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = memories.filter((m) => {
    const typeOk  = typeFilter === "all" || m.type === typeFilter;
    const searchOk = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return typeOk && searchOk;
  });

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function deleteMemory(id: string) {
    setMemories(memories.filter((m) => m.id !== id));
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Memory Browser</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as MemoryTypeFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="long_term">Long-term</TabsTrigger>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Memory List */}
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="space-y-3 pr-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No memories found.</div>
          )}
          {filtered.map((mem) => {
            const agent     = agents.find((a) => a.id === mem.agentId);
            const expanded  = expandedIds.has(mem.id);
            const preview   = mem.content.length > 120 ? mem.content.slice(0, 120) + "..." : mem.content;

            return (
              <div key={mem.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={typeBadgeVariant(mem.type)}>{typeLabel(mem.type)}</Badge>
                    <span className="text-xs text-muted-foreground">{mem.date}</span>
                    {agent && <span className="text-xs text-muted-foreground">{agent.emoji} {agent.name}</span>}
                    <span className="text-xs text-muted-foreground">{mem.tokens} tokens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(mem.id)}>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMemory(mem.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed font-mono">
                  {expanded ? mem.content : preview}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

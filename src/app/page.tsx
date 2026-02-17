"use client";

import { useStore } from "@/lib/store";
import { Agent, LogEntry } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Activity, Zap, DollarSign, Circle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

function statusVariant(status: Agent["status"]): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "online": return "default";
    case "busy":   return "secondary";
    case "error":  return "destructive";
    default:       return "outline";
  }
}

function logLevelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "error": return "text-red-400";
    case "warn":  return "text-amber-400";
    case "debug": return "text-purple-400";
    default:      return "text-emerald-400";
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function DashboardPage() {
  const { agents, gateway, logs, costEntries } = useStore();

  const onlineCount      = agents.filter((a) => a.status === "online" || a.status === "busy").length;
  const totalTokensToday = agents.reduce((s, a) => s + a.tokensUsed, 0);
  const totalCostToday   = agents.reduce((s, a) => s + a.costToday,  0);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    const tokens = costEntries
      .filter((e) => e.date === key)
      .reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
    return { day: d.toLocaleDateString("en-US", { weekday: "short" }), tokens: Math.round(tokens / 1000) };
  });

  const recentLogs = logs.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {onlineCount}<span className="text-muted-foreground text-base font-normal">/{agents.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">online / total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gateway.activeSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">running right now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totalTokensToday)}</div>
            <p className="text-xs text-muted-foreground mt-1">across all agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostToday.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">total spend today</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Fleet */}
      <Card>
        <CardHeader><CardTitle>Agent Fleet</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{agent.emoji}</span>
                    <span className="font-semibold">{agent.name}</span>
                  </div>
                  <Badge variant={statusVariant(agent.status)}>
                    <Circle className="h-2 w-2 mr-1 fill-current" />
                    {agent.status}
                  </Badge>
                </div>
                {agent.currentTask && (
                  <p className="text-xs text-muted-foreground truncate">{agent.currentTask}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[140px]">{agent.model}</span>
                  <span>{formatTokens(agent.tokensUsed)} tokens</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Token Usage — Last 7 Days</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "K"} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "6px" }} formatter={(v: unknown) => [v + "K tokens", "Tokens"]} />
                <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[260px]">
              <div className="px-6 pb-4 space-y-3 pt-2">
                {recentLogs.map((log) => {
                  const agent = agents.find((a) => a.id === log.agentId);
                  return (
                    <div key={log.id} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                        <span className={"text-xs font-medium uppercase " + logLevelColor(log.level)}>{log.level}</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        {agent && <span className="font-medium">{agent.emoji} </span>}
                        {log.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

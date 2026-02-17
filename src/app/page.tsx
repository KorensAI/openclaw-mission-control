"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Activity, Zap, DollarSign, Circle, RefreshCw, WifiOff } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import type { DashboardData } from "@/app/api/dashboard/route";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function statusVariant(
  status: "online" | "offline" | "busy" | "error"
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "online": return "default";
    case "busy":   return "secondary";
    case "error":  return "destructive";
    default:       return "outline";
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-24 bg-muted rounded mb-1" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }
      const json: DashboardData = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const agents       = data?.agents ?? [];
  const last7Days    = data?.last7Days ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const onlineCount  = agents.filter((a) => a.status === "online" || a.status === "busy").length;
  const totalTokens  = data?.totalTokensToday ?? 0;
  const totalCost    = data?.totalCostToday ?? 0;
  const activeSessions = agents.reduce((s, a) => s + a.sessionsToday, 0);

  // ── Not installed banner ───────────────────────────────────────────────────
  if (!loading && data && !data.installed) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">OpenClaw not detected</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          No installation found at <code className="bg-muted px-1 rounded">~/.openclaw/</code>.
          Start OpenClaw and refresh.
        </p>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {data?.gatewayRunning && (
            <Badge variant="default" className="text-xs">
              <Circle className="h-2 w-2 mr-1 fill-current text-emerald-400" />
              Gateway live
            </Badge>
          )}
          {error && (
            <Badge variant="destructive" className="text-xs">{error}</Badge>
          )}
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={lastRefreshed ? `Last refreshed ${lastRefreshed.toLocaleTimeString()}` : ""}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {lastRefreshed
            ? `Refreshed ${formatDistanceToNow(lastRefreshed, { addSuffix: true })}`
            : "Loading…"}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <MetricSkeleton /> : (
              <>
                <div className="text-2xl font-bold">
                  {onlineCount}
                  <span className="text-muted-foreground text-base font-normal">/{agents.length}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agents.length === 0 ? "no agents found" : "online / total"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <MetricSkeleton /> : (
              <>
                <div className="text-2xl font-bold">{activeSessions}</div>
                <p className="text-xs text-muted-foreground mt-1">across all agents</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <MetricSkeleton /> : (
              <>
                <div className="text-2xl font-bold">{formatTokens(totalTokens)}</div>
                <p className="text-xs text-muted-foreground mt-1">across all agents</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <MetricSkeleton /> : (
              <>
                <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
                <p className="text-xs text-muted-foreground mt-1">total spend today</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Fleet */}
      <Card>
        <CardHeader><CardTitle>Agent Fleet</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 animate-pulse h-28" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No agents found in ~/.openclaw/openclaw.json
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-lg border border-border bg-muted/30 p-4 space-y-3"
                >
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
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span className="truncate max-w-[160px]">{agent.model}</span>
                      <span>{formatTokens(agent.tokensToday)} tokens today</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{agent.sessionsToday} session{agent.sessionsToday !== 1 ? "s" : ""} today</span>
                      <span>${agent.costToday.toFixed(4)}</span>
                    </div>
                    {agent.lastActive && (
                      <div className="text-muted-foreground/70">
                        Last active {formatDistanceToNow(new Date(agent.lastActive), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Token Usage — Last 7 Days</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px] bg-muted/30 rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v + "K"}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                    }}
                    formatter={(v: unknown) => [v + "K tokens", "Tokens"]}
                  />
                  <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[260px]">
              <div className="px-6 pb-4 space-y-3 pt-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1 animate-pulse">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-3 w-48 bg-muted rounded" />
                    </div>
                  ))
                ) : recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground pt-4">
                    No recent activity found.
                  </p>
                ) : (
                  recentActivity.map((entry) => (
                    <div key={entry.id} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </span>
                        <span className="text-xs font-medium text-emerald-400 uppercase">
                          {entry.agentId}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        <span className="font-medium">{entry.agentEmoji} </span>
                        {entry.message.length > 120
                          ? entry.message.slice(0, 120) + "…"
                          : entry.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

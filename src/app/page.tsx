"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Users,
  Activity,
  Zap,
  DollarSign,
  RefreshCw,
  WifiOff,
  Play,
  Square,
  RotateCcw,
  Terminal,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import type { DashboardData, DashboardAgent } from "@/app/api/dashboard/route";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function statusColor(status: DashboardAgent["status"]): string {
  switch (status) {
    case "online":
      return "text-emerald-400";
    case "busy":
      return "text-amber-400";
    case "error":
      return "text-red-400";
    default:
      return "text-zinc-500";
  }
}

function statusBg(status: DashboardAgent["status"]): string {
  switch (status) {
    case "online":
      return "bg-emerald-500/10 border-emerald-500/20";
    case "busy":
      return "bg-amber-500/10 border-amber-500/20";
    case "error":
      return "bg-red-500/10 border-red-500/20";
    default:
      return "bg-zinc-500/10 border-zinc-500/20";
  }
}

function statusDot(status: DashboardAgent["status"]): string {
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

// ─── AnimatedNumber ─────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    }

    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
      {suffix}
    </span>
  );
}

// ─── Skeleton Components ────────────────────────────────────────────────────

function MetricCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded skeleton-shimmer" />
        <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
      </div>
      <div className="h-8 w-28 rounded skeleton-shimmer" />
      <div className="h-2.5 w-24 rounded skeleton-shimmer" />
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full skeleton-shimmer" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="h-2 w-full rounded-full skeleton-shimmer" />
      <div className="flex justify-between">
        <div className="h-3 w-16 rounded skeleton-shimmer" />
        <div className="h-3 w-16 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[260px] flex items-end gap-2 px-4 pb-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 skeleton-shimmer rounded-t"
          style={{
            height: `${30 + Math.random() * 50}%`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="h-8 w-8 rounded-full skeleton-shimmer shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 rounded skeleton-shimmer" />
            <div className="h-3 w-full rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MetricCard ─────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  prefix,
  suffix,
  decimals,
  subtitle,
  icon: Icon,
  gradient,
  delay,
  loading,
  trend,
}: {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  delay: number;
  loading: boolean;
  trend?: "up" | "down" | "neutral";
}) {
  if (loading) return <MetricCardSkeleton />;

  return (
    <div
      className="glass-card gradient-border rounded-xl p-5 group hover:bg-white/[0.05] transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${gradient}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="text-3xl font-bold tracking-tight text-white animate-count-up">
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>

      <div className="flex items-center gap-2 mt-2">
        {trend === "up" && (
          <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
            <TrendingUp className="h-3 w-3" />
          </span>
        )}
        {trend === "down" && (
          <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
            <TrendingDown className="h-3 w-3" />
          </span>
        )}
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── AgentCard ──────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  index,
  onViewLogs,
  onAction,
}: {
  agent: DashboardAgent;
  index: number;
  onViewLogs: (agent: DashboardAgent) => void;
  onAction: (agentId: string, action: "start" | "stop" | "restart") => void;
}) {
  const tokenPercent = agent.tokensToday > 0 ? Math.min((agent.tokensToday / 500_000) * 100, 100) : 0;

  return (
    <div
      className="glass-card rounded-xl p-5 group hover:bg-white/[0.05] transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-2xl block">{agent.emoji}</span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${statusDot(agent.status)} ${agent.status === "online" ? "animate-live-pulse" : ""}`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">{agent.name}</h3>
            <p className="text-xs text-zinc-500 font-mono truncate max-w-[140px]">
              {agent.model}
            </p>
          </div>
        </div>
        <Badge
          className={`text-[10px] font-medium border ${statusBg(agent.status)} ${statusColor(agent.status)} bg-transparent`}
        >
          {agent.status}
        </Badge>
      </div>

      {/* Token usage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
          <span>Tokens today</span>
          <span className="text-zinc-300 font-medium">{formatTokens(agent.tokensToday)}</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000 ease-out"
            style={{ width: `${tokenPercent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs mb-4">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <Activity className="h-3 w-3" />
          <span>
            {agent.sessionsToday} session{agent.sessionsToday !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500">
          <DollarSign className="h-3 w-3" />
          <span className="text-zinc-300 font-medium">${agent.costToday.toFixed(4)}</span>
        </div>
      </div>

      {/* Last active */}
      {agent.lastActive && (
        <p className="text-[11px] text-zinc-600 mb-4 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Active {formatDistanceToNow(new Date(agent.lastActive), { addSuffix: true })}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.06]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                onClick={() => onAction(agent.id, "start")}
              >
                <Play className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start agent</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => onAction(agent.id, "stop")}
              >
                <Square className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop agent</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                onClick={() => onAction(agent.id, "restart")}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart agent</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="xs"
          className="text-zinc-400 hover:text-white text-[11px] gap-1"
          onClick={() => onViewLogs(agent)}
        >
          <Terminal className="h-3 w-3" />
          Logs
        </Button>
      </div>
    </div>
  );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 border border-white/10 shadow-xl">
      <p className="text-[11px] text-zinc-400 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold text-white">
          {entry.dataKey === "cost"
            ? `$${entry.value.toFixed(4)}`
            : `${entry.value}K tokens`}
        </p>
      ))}
    </div>
  );
}

// ─── Agent Log Sheet ────────────────────────────────────────────────────────

function AgentLogSheet({
  agent,
  open,
  onClose,
}: {
  agent: DashboardAgent | null;
  open: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (!agent || !open) return;
    setLogsLoading(true);
    fetch(`/api/logs?agent=${agent.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLogs(data.map((l: { message?: string; timestamp?: string }) =>
            `[${l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : "??"}] ${l.message || "..."}`
          ));
        } else {
          setLogs(["No logs available for this agent."]);
        }
      })
      .catch(() => setLogs(["Failed to load logs."]))
      .finally(() => setLogsLoading(false));
  }, [agent, open]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-zinc-950 border-zinc-800 w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Terminal className="h-4 w-4 text-emerald-400" />
            {agent?.emoji} {agent?.name} Logs
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Recent activity and output from this agent
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex-1 overflow-hidden">
          <div className="bg-black/50 rounded-lg border border-zinc-800 p-4 h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed">
            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-3 skeleton-shimmer rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
                ))}
              </div>
            ) : (
              logs.map((line, i) => (
                <div
                  key={i}
                  className="text-zinc-400 py-0.5 animate-fade-in"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <span className="text-zinc-600 select-none">{String(i + 1).padStart(3, " ")} </span>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [logSheetAgent, setLogSheetAgent] = useState<DashboardAgent | null>(null);
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
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
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Agent actions (UI-only -- will call gateway when available)
  const handleAgentAction = useCallback(
    (agentId: string, action: "start" | "stop" | "restart") => {
      // For now this is a UI placeholder. The gateway API will handle these commands.
      console.log(`Agent ${agentId}: ${action}`);
    },
    []
  );

  const handleViewLogs = useCallback((agent: DashboardAgent) => {
    setLogSheetAgent(agent);
    setLogSheetOpen(true);
  }, []);

  // Derived
  const agents = data?.agents ?? [];
  const last7Days = data?.last7Days ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const onlineCount = agents.filter(
    (a) => a.status === "online" || a.status === "busy"
  ).length;
  const totalTokens = data?.totalTokensToday ?? 0;
  const totalCost = data?.totalCostToday ?? 0;
  const activeSessions = agents.reduce((s, a) => s + a.sessionsToday, 0);

  // Not installed
  if (!loading && data && !data.installed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
            <WifiOff className="h-10 w-10 text-zinc-600" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-xl -z-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-white">OpenClaw not detected</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            No installation found at{" "}
            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-300">
              ~/.openclaw/
            </code>
            . Start OpenClaw and refresh.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchDashboard}
          className="gap-2 border-zinc-700 hover:bg-zinc-800"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 -m-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Mission Control
          </h1>
          {data?.gatewayRunning && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-medium gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-live-pulse" />
              Gateway Live
            </Badge>
          )}
          {error && (
            <Badge variant="destructive" className="text-[10px]">
              {error}
            </Badge>
          )}
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.03]"
          title={
            lastRefreshed
              ? `Last refreshed ${lastRefreshed.toLocaleTimeString()}`
              : ""
          }
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          {lastRefreshed
            ? `${formatDistanceToNow(lastRefreshed, { addSuffix: true })}`
            : "Loading..."}
        </button>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-6">
        <MetricCard
          title="Active Agents"
          value={onlineCount}
          suffix={` / ${agents.length}`}
          subtitle={agents.length === 0 ? "no agents configured" : "online / total"}
          icon={Users}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          delay={0}
          loading={loading}
          trend={onlineCount > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Sessions Today"
          value={activeSessions}
          subtitle="across all agents"
          icon={Activity}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          delay={80}
          loading={loading}
          trend={activeSessions > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Tokens Today"
          value={totalTokens}
          subtitle={totalTokens >= 1000 ? `${formatTokens(totalTokens)} total` : "across all agents"}
          icon={Zap}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          delay={160}
          loading={loading}
          trend={totalTokens > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Cost Today"
          value={totalCost}
          prefix="$"
          decimals={4}
          subtitle="total spend today"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700"
          delay={240}
          loading={loading}
        />
      </div>

      {/* ── Agent Fleet ────────────────────────────────────────────────────── */}
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Agent Fleet</h2>
            <Badge variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700">
              {agents.length} agent{agents.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          {!loading && agents.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {onlineCount} online
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-zinc-600" />
                {agents.length - onlineCount} offline
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <AgentCardSkeleton key={i} />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Sparkles className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              No agents found in{" "}
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-zinc-400">
                ~/.openclaw/openclaw.json
              </code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                onViewLogs={handleViewLogs}
                onAction={handleAgentAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Charts + Activity ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-6 pb-6">
        {/* Token Usage Chart */}
        <Card className="xl:col-span-2 glass-card border-white/[0.06] bg-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                Token Usage
              </CardTitle>
              <span className="text-[11px] text-zinc-500 font-medium">Last 7 days</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={last7Days} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#52525b" }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#52525b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v + "K"}
                    dx={-4}
                  />
                  <RechartsTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ stroke: "rgba(255,255,255,0.06)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#tokenGradient)"
                    dot={{ r: 3, fill: "#10b981", stroke: "#0d1117", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "#10b981", stroke: "#0d1117", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card border-white/[0.06] bg-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                  <Activity className="h-3.5 w-3.5 text-violet-400" />
                </div>
                Activity
              </CardTitle>
              <span className="text-[11px] text-zinc-500 font-medium">Latest</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[280px] custom-scrollbar">
              <div className="px-6 pb-4 space-y-1 pt-1">
                {loading ? (
                  <ActivitySkeleton />
                ) : recentActivity.length === 0 ? (
                  <div className="py-12 text-center">
                    <Activity className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-600">No recent activity</p>
                  </div>
                ) : (
                  recentActivity.map((entry, i) => (
                    <div
                      key={entry.id}
                      className="group flex gap-3 py-2.5 rounded-lg px-2 -mx-2 hover:bg-white/[0.02] transition-colors animate-fade-in"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="shrink-0 mt-0.5">
                        <span className="text-lg">{entry.agentEmoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">
                            {entry.agentId}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {formatDistanceToNow(new Date(entry.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                          {entry.message.length > 120
                            ? entry.message.slice(0, 120) + "..."
                            : entry.message}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-700 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── Agent Log Sheet ────────────────────────────────────────────────── */}
      <AgentLogSheet
        agent={logSheetAgent}
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
      />
    </div>
  );
}

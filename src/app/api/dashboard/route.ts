/**
 * GET /api/dashboard
 *
 * Single aggregated endpoint for the Dashboard page.
 * Returns all data needed to render the dashboard in one network request:
 *   - agents (from openclaw.json agents.list)
 *   - gateway status
 *   - per-agent session stats (token totals, cost) for today + last 7 days
 *   - recent activity log (last 20 assistant messages across all agents)
 *
 * Falls back gracefully when OpenClaw is not installed.
 */

import { NextResponse } from "next/server";
import {
  discoverOpenClaw,
  readAgentConfigs,
  readAgentSessions,
  type AgentConfig,
  type SessionLogEntry,
} from "@/lib/openclaw-discovery";

// ─── Response shape ────────────────────────────────────────────────────────────

export interface DashboardAgent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  status: "online" | "offline" | "busy" | "error";
  sessionsToday: number;
  tokensToday: number;
  costToday: number;
  lastActive: string | null;
  capabilities: string[];
}

export interface DashboardDayStats {
  day: string;   // "Mon", "Tue", etc.
  date: string;  // "YYYY-MM-DD"
  tokens: number;
  cost: number;
}

export interface DashboardActivity {
  id: string;
  agentId: string;
  agentEmoji: string;
  timestamp: string;
  message: string;
  model: string;
}

export interface DashboardData {
  installed: boolean;
  gatewayRunning: boolean;
  agents: DashboardAgent[];
  /** Token usage + cost per day for the last 7 days (oldest → newest) */
  last7Days: DashboardDayStats[];
  /** Most recent assistant turns across all agents */
  recentActivity: DashboardActivity[];
  totalTokensToday: number;
  totalCostToday: number;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function shortDay(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<DashboardData>> {
  const discovery = await discoverOpenClaw();

  if (!discovery.installed) {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = dateStr(6 - i);
      return { day: shortDay(d), date: d, tokens: 0, cost: 0 };
    });

    return NextResponse.json({
      installed: false,
      gatewayRunning: false,
      agents: [],
      last7Days,
      recentActivity: [],
      totalTokensToday: 0,
      totalCostToday: 0,
      generatedAt: new Date().toISOString(),
    });
  }

  const todayStr = dateStr(0);

  // Build the date window: last 7 days as "YYYY-MM-DD" strings, oldest first
  const last7DateStrings = Array.from({ length: 7 }, (_, i) => dateStr(6 - i));

  // Day-level accumulators keyed by "YYYY-MM-DD"
  const dayTokens: Record<string, number> = {};
  const dayCost: Record<string, number> = {};
  for (const d of last7DateStrings) {
    dayTokens[d] = 0;
    dayCost[d] = 0;
  }

  // Per-agent stats
  const agentConfigs: AgentConfig[] = await readAgentConfigs();

  // Fetch sessions for all agents in parallel
  const agentSessionsMap = new Map<string, SessionLogEntry[]>();
  await Promise.all(
    agentConfigs.map(async (cfg) => {
      const sessions = await readAgentSessions(cfg.id);
      agentSessionsMap.set(cfg.id, sessions);
    })
  );

  // Build agent stats
  const dashboardAgents: DashboardAgent[] = agentConfigs.map((cfg) => {
    const sessions = agentSessionsMap.get(cfg.id) ?? [];

    let sessionsToday = 0;
    let tokensToday = 0;
    let costToday = 0;
    let lastActive: string | null = null;
    const seenSessionIds = new Set<string>();

    for (const s of sessions) {
      // Accumulate per-day stats (last 7 days)
      const sDate = s.timestamp.split("T")[0];
      if (sDate in dayTokens) {
        dayTokens[sDate] += s.inputTokens + s.outputTokens;
        dayCost[sDate] += s.cost;
      }

      // Today-specific stats
      if (sDate === todayStr) {
        tokensToday += s.inputTokens + s.outputTokens;
        costToday += s.cost;

        if (!seenSessionIds.has(s.sessionId)) {
          seenSessionIds.add(s.sessionId);
          sessionsToday++;
        }
      }

      // Track most-recent activity
      if (!lastActive || s.timestamp > lastActive) {
        lastActive = s.timestamp;
      }
    }

    return {
      id: cfg.id,
      name: cfg.name,
      emoji: cfg.emoji,
      model: cfg.model,
      // Status is "offline" unless the gateway is running (we can't know per-agent status
      // from the filesystem alone without probing the gateway live API)
      status: "offline" as const,
      sessionsToday,
      tokensToday,
      costToday,
      lastActive,
      capabilities: cfg.capabilities,
    };
  });

  // Build last-7-days chart data
  const last7Days: DashboardDayStats[] = last7DateStrings.map((d) => ({
    day: shortDay(d),
    date: d,
    tokens: Math.round((dayTokens[d] ?? 0) / 1000), // in K-tokens for chart display
    cost: Math.round((dayCost[d] ?? 0) * 10000) / 10000, // 4 decimal places
  }));

  // Collect recent activity: last 20 assistant messages across all agents
  const allAssistantTurns: (SessionLogEntry & { agentEmoji: string })[] = [];
  for (const [agentId, sessions] of agentSessionsMap) {
    const cfg = agentConfigs.find((c) => c.id === agentId);
    const emoji = cfg?.emoji ?? "?";
    const assistantTurns = sessions
      .filter((s) => s.role === "assistant" && s.content.trim().length > 0)
      .map((s) => ({ ...s, agentEmoji: emoji }));
    allAssistantTurns.push(...assistantTurns);
  }

  allAssistantTurns.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const recentActivity: DashboardActivity[] = allAssistantTurns
    .slice(0, 20)
    .map((s) => ({
      id: s.sessionId + "-" + s.timestamp,
      agentId: s.agentId,
      agentEmoji: s.agentEmoji,
      timestamp: s.timestamp,
      message: s.content.slice(0, 200),
      model: s.model ?? "unknown",
    }));

  const totalTokensToday = dashboardAgents.reduce(
    (sum, a) => sum + a.tokensToday,
    0
  );
  const totalCostToday = dashboardAgents.reduce(
    (sum, a) => sum + a.costToday,
    0
  );

  return NextResponse.json({
    installed: true,
    gatewayRunning: discovery.gatewayRunning,
    agents: dashboardAgents,
    last7Days,
    recentActivity,
    totalTokensToday,
    totalCostToday,
    generatedAt: new Date().toISOString(),
  });
}

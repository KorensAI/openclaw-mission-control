/**
 * GET /api/logs?limit=<n>
 *
 * Returns session log entries across all agents, formatted as LogEntry objects.
 * Reads from ~/.openclaw/agents/<id>/sessions/*.jsonl for each agent.
 *
 * Query params:
 *   limit (optional, default 500) - max entries to return
 *
 * Returns an empty array when OpenClaw is not installed.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  discoverOpenClaw,
  readAgentConfigs,
  readAgentSessions,
} from "@/lib/openclaw-discovery";
import type { LogEntry } from "@/types";

const MAX_LIMIT = 2000;
const DEFAULT_LIMIT = 500;

export async function GET(
  request: NextRequest
): Promise<NextResponse<LogEntry[] | { error: string }>> {
  const { searchParams } = request.nextUrl;
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit
    ? Math.min(Math.max(1, parseInt(rawLimit, 10) || DEFAULT_LIMIT), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const discovery = await discoverOpenClaw();
    if (!discovery.installed) {
      return NextResponse.json([]);
    }

    const agents = await readAgentConfigs();
    const allLogs: LogEntry[] = [];

    // Read sessions for all agents in parallel
    const results = await Promise.all(
      agents.map(async (agent) => {
        const sessions = await readAgentSessions(agent.id);
        return { agent, sessions };
      })
    );

    for (const { agent, sessions } of results) {
      for (const session of sessions) {
        // Map session entries to LogEntry format
        const level =
          session.role === "user"
            ? ("debug" as const)
            : session.cost > 0
              ? ("info" as const)
              : ("debug" as const);

        allLogs.push({
          id: `${session.sessionId}-${session.timestamp}`,
          timestamp: session.timestamp,
          level,
          agentId: agent.id,
          message:
            session.content.length > 200
              ? session.content.slice(0, 200) + "..."
              : session.content || `[${session.role}] (no content)`,
          metadata: {
            role: session.role,
            model: session.model,
            inputTokens: session.inputTokens,
            outputTokens: session.outputTokens,
            cost: session.cost,
            sessionId: session.sessionId,
          },
        });
      }
    }

    // Sort newest-first and truncate
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json(allLogs.slice(0, limit));
  } catch (err) {
    console.error("[/api/logs] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read log data" },
      { status: 500 }
    );
  }
}

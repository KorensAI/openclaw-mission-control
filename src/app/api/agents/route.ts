/**
 * GET /api/agents
 *
 * Lists agents discovered in ~/.openclaw/agents/.
 * Returns an empty array when OpenClaw is not installed.
 */

import { NextResponse } from "next/server";
import { readInstalledAgents, isOpenClawInstalled } from "@/lib/api";
import type { Agent } from "@/types";

export async function GET(): Promise<NextResponse<Agent[] | { error: string }>> {
  try {
    const installed = await isOpenClawInstalled();
    if (!installed) {
      return NextResponse.json([]);
    }

    const rawAgents = await readInstalledAgents();

    // Map filesystem data to the Agent type, filling in required defaults
    const agents: Agent[] = rawAgents.map((a) => ({
      id: a.id ?? "unknown",
      name: a.name ?? "Unknown Agent",
      emoji: a.emoji ?? "?",
      status: "offline" as const,
      uptime: 0,
      sessionsToday: 0,
      tokensUsed: 0,
      costToday: 0,
      lastActive: new Date().toISOString(),
      capabilities: a.capabilities ?? [],
      model: a.model ?? "unknown",
    }));

    return NextResponse.json(agents);
  } catch (err) {
    console.error("[/api/agents] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read agent data" },
      { status: 500 }
    );
  }
}

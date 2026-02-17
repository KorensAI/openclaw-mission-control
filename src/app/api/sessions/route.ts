/**
 * GET /api/sessions?agentId=<id>&limit=<n>
 *
 * Returns session history for a given agent from
 * ~/.openclaw/agents/<agentId>/sessions/*.jsonl
 *
 * Query params:
 *   agentId  (required) - the agent directory name
 *   limit    (optional, default 100) - max entries to return
 */

import { NextRequest, NextResponse } from "next/server";
import { readAgentSessions, isOpenClawInstalled } from "@/lib/api";

const MAX_LIMIT = 1_000;
const DEFAULT_LIMIT = 100;

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  if (!agentId || typeof agentId !== "string" || agentId.trim() === "") {
    return NextResponse.json(
      { error: "Missing required query parameter: agentId" },
      { status: 400 }
    );
  }

  // Path-traversal guard: reject any agentId containing directory separators
  if (agentId.includes("..") || agentId.includes("/") || agentId.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid agentId" },
      { status: 400 }
    );
  }

  const rawLimit = searchParams.get("limit");
  const limit = rawLimit
    ? Math.min(Math.max(1, parseInt(rawLimit, 10) || DEFAULT_LIMIT), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const installed = await isOpenClawInstalled();
    if (!installed) {
      return NextResponse.json([]);
    }

    const entries = await readAgentSessions(agentId.trim());
    return NextResponse.json(entries.slice(0, limit));
  } catch (err) {
    console.error("[/api/sessions] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read session data" },
      { status: 500 }
    );
  }
}

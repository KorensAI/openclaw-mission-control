/**
 * /api/gateway
 *
 * Unified gateway API route.
 *
 * Endpoints (all via query params on the same path):
 *
 *   GET /api/gateway              → gateway status (installed, running, version, config)
 *   GET /api/gateway?resource=agents    → list agents discovered locally
 *   GET /api/gateway?resource=sessions  → session entries for a given agent
 *                                         (requires &agentId=<id>, optional &limit=<n>)
 *
 * When the gateway is running locally (ws://127.0.0.1:18789) the status
 * endpoint also reflects live agent / session counts obtained from the
 * WebSocket handshake (same probe used by /api/gateway/status).
 */

import { NextRequest, NextResponse } from "next/server";
import type { GatewayStatus, Agent } from "@/types";
import {
  discoverOpenClaw,
  readOpenClawConfig,
  readAgentConfigs,
  readAgentSessions,
  getWorkspaceSummary,
  type OpenClawConfig,
  type AgentConfig,
  type SessionLogEntry,
} from "@/lib/openclaw-discovery";

// ─── Constants ────────────────────────────────────────────────────────────────

const GATEWAY_WS_URL = "ws://127.0.0.1:18789";
const GATEWAY_HTTP_URL = "http://127.0.0.1:18789";
const CONNECT_TIMEOUT_MS = 3_000;
const DEFAULT_SESSION_LIMIT = 100;
const MAX_SESSION_LIMIT = 1_000;

// ─── Gateway probe ────────────────────────────────────────────────────────────

interface GatewayHandshake {
  type?: string;
  version?: string;
  uptime?: number;
  agents?: number;
  channels?: number;
  activeSessions?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

/**
 * Attempts a WebSocket connection to the local gateway and requests a status
 * message. Returns running=false on timeout or error.
 */
async function probeGatewayWs(): Promise<{
  running: boolean;
  info?: GatewayHandshake;
  error?: string;
}> {
  let WS: typeof import("ws").default;
  try {
    ({ default: WS } = await import("ws"));
  } catch {
    return { running: false, error: "ws package not available" };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.terminate();
      resolve({ running: false, error: "Connection timed out" });
    }, CONNECT_TIMEOUT_MS);

    const ws = new WS(GATEWAY_WS_URL);

    ws.once("open", () => {
      ws.send(JSON.stringify({ type: "status" }));
    });

    ws.once("message", (data: Buffer | string) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(data.toString()) as GatewayHandshake;
        ws.close();
        resolve({ running: true, info: msg });
      } catch {
        ws.close();
        resolve({ running: true });
      }
    });

    ws.once("error", (err: Error) => {
      clearTimeout(timer);
      resolve({ running: false, error: err.message });
    });
  });
}

/**
 * Tries to proxy a request to the local gateway HTTP API.
 * Falls back gracefully if the gateway is not running.
 */
async function proxyToGateway(
  endpoint: string,
  init?: RequestInit
): Promise<Response | null> {
  try {
    const url = `${GATEWAY_HTTP_URL}${endpoint}`;
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
    });
    return response;
  } catch {
    return null;
  }
}

// ─── Handler helpers ──────────────────────────────────────────────────────────

/** Builds the GatewayStatus response by combining probe + filesystem data. */
async function handleStatus(): Promise<NextResponse<GatewayStatus>> {
  const [discovery, config, probe] = await Promise.all([
    discoverOpenClaw(),
    readOpenClawConfig(),
    probeGatewayWs(),
  ]);

  // If the gateway is up, try to also get live data via HTTP
  let liveInfo: GatewayHandshake | undefined;
  if (probe.running) {
    const liveRes = await proxyToGateway("/status");
    if (liveRes?.ok) {
      liveInfo = (await liveRes.json()) as GatewayHandshake;
    }
  }

  const merged: GatewayHandshake = { ...probe.info, ...liveInfo };

  const status: GatewayStatus = {
    running: probe.running,
    version:
      merged.version ??
      (config as OpenClawConfig | null)?.version ??
      "unknown",
    uptime: merged.uptime ?? 0,
    address: GATEWAY_WS_URL,
    agents: merged.agents ?? 0,
    channels: merged.channels ?? 0,
    activeSessions: merged.activeSessions ?? 0,
    cpuUsage: merged.cpuUsage ?? 0,
    memoryUsage: merged.memoryUsage ?? 0,
  };

  return NextResponse.json(status);
}

/** Lists agents: prefers live gateway data, falls back to filesystem. */
async function handleAgents(): Promise<NextResponse<Agent[] | { error: string }>> {
  // Try the live gateway HTTP API first
  const liveRes = await proxyToGateway("/agents");
  if (liveRes?.ok) {
    try {
      const liveAgents = (await liveRes.json()) as Agent[];
      if (Array.isArray(liveAgents) && liveAgents.length > 0) {
        return NextResponse.json(liveAgents);
      }
    } catch {
      // Fall through to filesystem
    }
  }

  // Filesystem fallback
  const { installed } = await discoverOpenClaw();
  if (!installed) return NextResponse.json([]);

  try {
    const configs: AgentConfig[] = await readAgentConfigs();
    const agents: Agent[] = configs.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      emoji: cfg.emoji,
      status: "offline" as const,
      uptime: 0,
      sessionsToday: 0,
      tokensUsed: 0,
      costToday: 0,
      lastActive: new Date().toISOString(),
      capabilities: cfg.capabilities,
      model: cfg.model,
    }));
    return NextResponse.json(agents);
  } catch (err) {
    console.error("[/api/gateway?resource=agents]", err);
    return NextResponse.json(
      { error: "Failed to read agent data" },
      { status: 500 }
    );
  }
}

/** Returns session log entries for a given agent. */
async function handleSessions(
  agentId: string,
  limit: number
): Promise<NextResponse<SessionLogEntry[] | { error: string }>> {
  // Path-traversal guard
  if (agentId.includes("..") || agentId.includes("/") || agentId.includes("\\")) {
    return NextResponse.json({ error: "Invalid agentId" }, { status: 400 });
  }

  const { installed } = await discoverOpenClaw();
  if (!installed) return NextResponse.json([]);

  // Try the live gateway HTTP API first
  const liveRes = await proxyToGateway(
    `/sessions?agentId=${encodeURIComponent(agentId)}&limit=${limit}`
  );
  if (liveRes?.ok) {
    try {
      const liveSessions = (await liveRes.json()) as SessionLogEntry[];
      if (Array.isArray(liveSessions)) return NextResponse.json(liveSessions);
    } catch {
      // Fall through to filesystem
    }
  }

  // Filesystem fallback
  try {
    const entries = await readAgentSessions(agentId);
    return NextResponse.json(entries.slice(0, limit));
  } catch (err) {
    console.error("[/api/gateway?resource=sessions]", err);
    return NextResponse.json(
      { error: "Failed to read session data" },
      { status: 500 }
    );
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const resource = searchParams.get("resource");

  try {
    // GET /api/gateway?resource=agents
    if (resource === "agents") {
      return await handleAgents();
    }

    // GET /api/gateway?resource=sessions&agentId=<id>&limit=<n>
    if (resource === "sessions") {
      const agentId = searchParams.get("agentId");
      if (!agentId || agentId.trim() === "") {
        return NextResponse.json(
          { error: "Missing required query parameter: agentId" },
          { status: 400 }
        );
      }

      const rawLimit = searchParams.get("limit");
      const limit = rawLimit
        ? Math.min(
            Math.max(1, parseInt(rawLimit, 10) || DEFAULT_SESSION_LIMIT),
            MAX_SESSION_LIMIT
          )
        : DEFAULT_SESSION_LIMIT;

      return await handleSessions(agentId.trim(), limit);
    }

    // GET /api/gateway  (default: status)
    return await handleStatus();
  } catch (err) {
    console.error("[/api/gateway] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gateway
 *
 * Proxies arbitrary commands to the running gateway HTTP API.
 * Returns 503 when the gateway is not running.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { installed } = await discoverOpenClaw();
  if (!installed) {
    return NextResponse.json(
      { error: "OpenClaw is not installed" },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint") ?? "/command";

  // Sanitise endpoint to prevent SSRF to non-gateway hosts
  if (!endpoint.startsWith("/")) {
    return NextResponse.json(
      { error: "Invalid endpoint" },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    body = "";
  }

  const response = await proxyToGateway(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response) {
    return NextResponse.json(
      { error: "Gateway is not reachable" },
      { status: 503 }
    );
  }

  const responseBody = await response.text();
  return new NextResponse(responseBody, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Export workspace summary for use by other internal routes
export { getWorkspaceSummary };

/**
 * GET /api/gateway/status
 *
 * Checks whether the OpenClaw WebSocket gateway is reachable.
 * Uses the Node.js ws package so this runs server-side only.
 */

import { NextResponse } from "next/server";
import type { GatewayStatus } from "@/types";
import { readOpenClawConfig } from "@/lib/api";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const CONNECT_TIMEOUT_MS = 3_000;

interface GatewayHandshake {
  type: string;
  version?: string;
  uptime?: number;
  agents?: number;
  channels?: number;
  activeSessions?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

async function probeGateway(): Promise<{
  running: boolean;
  info?: GatewayHandshake;
  error?: string;
}> {
  // Dynamic import keeps ws out of the browser bundle
  const { default: WS } = await import("ws");

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.terminate();
      resolve({ running: false, error: "Connection timed out" });
    }, CONNECT_TIMEOUT_MS);

    const ws = new WS(GATEWAY_URL);

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

export async function GET(): Promise<NextResponse<GatewayStatus>> {
  const config = await readOpenClawConfig();

  let result: { running: boolean; info?: GatewayHandshake; error?: string };

  try {
    result = await probeGateway();
  } catch (err) {
    result = {
      running: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const status: GatewayStatus = {
    running: result.running,
    version: result.info?.version ?? config?.version ?? "unknown",
    uptime: result.info?.uptime ?? 0,
    address: GATEWAY_URL,
    agents: result.info?.agents ?? 0,
    channels: result.info?.channels ?? 0,
    activeSessions: result.info?.activeSessions ?? 0,
    cpuUsage: result.info?.cpuUsage ?? 0,
    memoryUsage: result.info?.memoryUsage ?? 0,
  };

  return NextResponse.json(status);
}

/**
 * GET /api/costs
 *
 * Returns cost entries aggregated from:
 *   1. ~/.openclaw/costs.jsonl (if present)
 *   2. Session logs (fallback)
 *
 * Uses readAllCostData() from openclaw-discovery.
 * Returns an empty array when OpenClaw is not installed.
 */

import { NextResponse } from "next/server";
import { readAllCostData, discoverOpenClaw } from "@/lib/openclaw-discovery";
import type { CostEntry } from "@/types";

export async function GET(): Promise<NextResponse<CostEntry[] | { error: string }>> {
  try {
    const discovery = await discoverOpenClaw();
    if (!discovery.installed) {
      return NextResponse.json([]);
    }

    const entries = await readAllCostData();
    return NextResponse.json(entries);
  } catch (err) {
    console.error("[/api/costs] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read cost data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron
 *
 * Returns cron job definitions from:
 *   - ~/.openclaw/openclaw.json -> "cron" array
 *   - ~/.openclaw/cron.json
 *   - ~/.openclaw/workspace/cron.json
 *
 * Returns an empty array when OpenClaw is not installed or no cron configs exist.
 */

import { NextResponse } from "next/server";
import { discoverOpenClaw, readCronConfigs } from "@/lib/openclaw-discovery";
import type { CronJob } from "@/types";

export async function GET(): Promise<NextResponse<CronJob[] | { error: string }>> {
  try {
    const discovery = await discoverOpenClaw();
    if (!discovery.installed) {
      return NextResponse.json([]);
    }

    const jobs = await readCronConfigs();
    return NextResponse.json(jobs);
  } catch (err) {
    console.error("[/api/cron] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read cron data" },
      { status: 500 }
    );
  }
}

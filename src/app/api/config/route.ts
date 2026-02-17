/**
 * GET /api/config
 *
 * Returns the OpenClaw configuration from:
 *   - ~/.openclaw/openclaw.json (preferred)
 *   - ~/.openclaw/config.json (fallback)
 *
 * Returns null when OpenClaw is not installed or no config exists.
 */

import { NextResponse } from "next/server";
import { discoverOpenClaw, readOpenClawConfig } from "@/lib/openclaw-discovery";
import type { OpenClawConfig } from "@/lib/openclaw-discovery";

export async function GET(): Promise<
  NextResponse<{ installed: boolean; config: OpenClawConfig | null }>
> {
  try {
    const discovery = await discoverOpenClaw();
    if (!discovery.installed) {
      return NextResponse.json({ installed: false, config: null });
    }

    const config = await readOpenClawConfig();
    return NextResponse.json({ installed: true, config });
  } catch (err) {
    console.error("[/api/config] Unexpected error:", err);
    return NextResponse.json({ installed: false, config: null });
  }
}

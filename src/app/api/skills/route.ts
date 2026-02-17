/**
 * GET /api/skills
 *
 * Lists all skills available to OpenClaw from:
 *   - workspace skills: ~/.openclaw/workspace/skills/
 *
 * Returns an empty array when OpenClaw is not installed.
 */

import { NextResponse } from "next/server";
import { getInstalledSkills, isOpenClawInstalled } from "@/lib/api";
import type { Skill } from "@/types";

export async function GET(): Promise<NextResponse<Skill[] | { error: string }>> {
  try {
    const installed = await isOpenClawInstalled();
    if (!installed) {
      return NextResponse.json([]);
    }

    const skills = await getInstalledSkills();
    return NextResponse.json(skills);
  } catch (err) {
    console.error("[/api/skills] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read skills data" },
      { status: 500 }
    );
  }
}

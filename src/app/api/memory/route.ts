/**
 * GET /api/memory?date=<YYYY-MM-DD>
 *
 * Returns memory entries from ~/.openclaw/workspace/
 *
 * Query params:
 *   date  (optional) - if provided, returns the single daily memory for that date
 *                      otherwise returns all memory entries
 */

import { NextRequest, NextResponse } from "next/server";
import { readMemoryFiles, readDailyMemory, isOpenClawInstalled } from "@/lib/api";
import type { MemoryEntry } from "@/types";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest
): Promise<NextResponse<MemoryEntry[] | { date: string; content: string | null } | { error: string }>> {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");

  if (date !== null && !DATE_REGEX.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Expected YYYY-MM-DD." },
      { status: 400 }
    );
  }

  try {
    const installed = await isOpenClawInstalled();
    if (!installed) {
      if (date) {
        return NextResponse.json({ date, content: null });
      }
      return NextResponse.json([]);
    }

    if (date) {
      const content = await readDailyMemory(date);
      return NextResponse.json({ date, content });
    }

    const entries = await readMemoryFiles();
    return NextResponse.json(entries);
  } catch (err) {
    console.error("[/api/memory] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read memory data" },
      { status: 500 }
    );
  }
}

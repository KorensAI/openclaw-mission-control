/**
 * POST /api/memory/update
 *
 * Saves updated content to a memory file.
 *
 * Body (JSON):
 *   {
 *     "relativePath": "SOUL.md" | "daily/2026-02-15.md" | etc,
 *     "content": "new file contents..."
 *   }
 *
 * The relativePath is resolved within ~/.openclaw/workspace/ and validated
 * to prevent directory traversal.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const OPENCLAW_ROOT = path.join(os.homedir(), ".openclaw");
const WORKSPACE_DIR = path.resolve(path.join(OPENCLAW_ROOT, "workspace"));

interface UpdateBody {
  relativePath: string;
  content: string;
}

function isPathSafe(resolvedPath: string): boolean {
  return (
    resolvedPath === WORKSPACE_DIR ||
    resolvedPath.startsWith(WORKSPACE_DIR + path.sep)
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: boolean; path: string } | { error: string }>> {
  try {
    const body = (await request.json()) as UpdateBody;

    if (!body.relativePath || typeof body.relativePath !== "string") {
      return NextResponse.json(
        { error: "Missing required field: relativePath" },
        { status: 400 }
      );
    }

    if (typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    // Resolve and validate path
    const sanitised = body.relativePath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\0/g, "");

    const resolvedPath = path.resolve(path.join(WORKSPACE_DIR, sanitised));

    if (!isPathSafe(resolvedPath)) {
      return NextResponse.json(
        { error: "Path is outside the allowed directory" },
        { status: 403 }
      );
    }

    // Only allow .md files
    if (!resolvedPath.endsWith(".md")) {
      return NextResponse.json(
        { error: "Only .md files can be edited" },
        { status: 400 }
      );
    }

    // Verify the file exists (don't create new files through this endpoint)
    try {
      await fs.access(resolvedPath);
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Write the file
    await fs.writeFile(resolvedPath, body.content, "utf-8");

    return NextResponse.json({
      success: true,
      path: sanitised,
    });
  } catch (err) {
    console.error("[/api/memory/update] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to save memory file" },
      { status: 500 }
    );
  }
}

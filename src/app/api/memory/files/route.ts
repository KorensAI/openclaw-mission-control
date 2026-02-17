/**
 * GET /api/memory/files
 *
 * Returns a list of all known memory files with metadata (size, lastModified).
 * Files scanned:
 *   - ~/.openclaw/workspace/SOUL.md
 *   - ~/.openclaw/workspace/USER.md
 *   - ~/.openclaw/workspace/MEMORY.md
 *   - ~/.openclaw/workspace/AGENTS.md
 *   - ~/.openclaw/workspace/daily/*.md
 */

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const OPENCLAW_ROOT = path.join(os.homedir(), ".openclaw");
const WORKSPACE_DIR = path.join(OPENCLAW_ROOT, "workspace");

export interface MemoryFileInfo {
  /** Unique identifier for the file (e.g. "SOUL.md", "daily/2026-02-15.md") */
  id: string;
  /** Display name */
  name: string;
  /** Relative path within workspace dir */
  relativePath: string;
  /** Absolute path on disk */
  absolutePath: string;
  /** "core" for top-level md files, "daily" for daily dir */
  category: "core" | "daily";
  /** File size in bytes */
  size: number;
  /** ISO string of last modification time */
  lastModified: string;
  /** File content */
  content: string;
}

async function getFileStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function listDirectory(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

export async function GET(): Promise<NextResponse<MemoryFileInfo[] | { error: string }>> {
  try {
    // Check workspace exists
    const stat = await getFileStat(WORKSPACE_DIR);
    if (!stat) {
      return NextResponse.json([]);
    }

    const files: MemoryFileInfo[] = [];

    // Scan core memory files
    const coreFiles = ["SOUL.md", "USER.md", "MEMORY.md", "AGENTS.md"];

    for (const name of coreFiles) {
      const absPath = path.join(WORKSPACE_DIR, name);
      const fileStat = await getFileStat(absPath);
      if (!fileStat) continue;

      const content = await readTextFile(absPath);
      if (content === null) continue;

      files.push({
        id: name,
        name,
        relativePath: name,
        absolutePath: absPath,
        category: "core",
        size: fileStat.size,
        lastModified: fileStat.mtime.toISOString(),
        content,
      });
    }

    // Scan daily directory
    const dailyDir = path.join(WORKSPACE_DIR, "daily");
    const dailyEntries = await listDirectory(dailyDir);
    const mdFiles = dailyEntries
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse(); // newest first

    for (const name of mdFiles) {
      const absPath = path.join(dailyDir, name);
      const fileStat = await getFileStat(absPath);
      if (!fileStat) continue;

      const content = await readTextFile(absPath);
      if (content === null) continue;

      const relPath = path.join("daily", name);

      files.push({
        id: relPath,
        name,
        relativePath: relPath,
        absolutePath: absPath,
        category: "daily",
        size: fileStat.size,
        lastModified: fileStat.mtime.toISOString(),
        content,
      });
    }

    return NextResponse.json(files);
  } catch (err) {
    console.error("[/api/memory/files] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to read memory files" },
      { status: 500 }
    );
  }
}

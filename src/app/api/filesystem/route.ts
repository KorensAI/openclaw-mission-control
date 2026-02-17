/**
 * /api/filesystem
 *
 * Read-only API route for browsing the local OpenClaw workspace.
 *
 * All paths are validated to ensure they remain inside ~/.openclaw/ to
 * prevent directory-traversal attacks.
 *
 * Endpoints (via query params):
 *
 *   GET /api/filesystem                         → workspace overview
 *   GET /api/filesystem?resource=config         → openclaw.json contents
 *   GET /api/filesystem?resource=agents         → agent config list
 *   GET /api/filesystem?resource=memory         → all memory files
 *   GET /api/filesystem?resource=memory&date=YYYY-MM-DD → single daily memory
 *   GET /api/filesystem?resource=skills         → installed skills list
 *   GET /api/filesystem?resource=file&path=<p>  → raw content of a file inside ~/.openclaw
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { MemoryEntry, Skill } from "@/types";
import {
  discoverOpenClaw,
  readOpenClawConfig,
  readAgentConfigs,
  readAllMemoryFiles,
  readDailyMemory,
  readInstalledSkills,
  readCronConfigs,
  type OpenClawConfig,
  type AgentConfig,
  type WorkspaceSummary,
  getWorkspaceSummary,
} from "@/lib/openclaw-discovery";

// ─── Security ─────────────────────────────────────────────────────────────────

const OPENCLAW_ROOT = path.resolve(path.join(os.homedir(), ".openclaw"));

/**
 * Resolves `userPath` and verifies it stays inside OPENCLAW_ROOT.
 *
 * Returns the absolute path on success, or null if the path escapes the
 * allowed directory (path-traversal attempt).
 */
function safeResolvePath(userPath: string): string | null {
  if (!userPath || typeof userPath !== "string") return null;

  // Strip leading slashes / dots to treat the input as relative
  const sanitised = userPath
    .replace(/\\/g, "/")       // normalise Windows separators
    .replace(/^\/+/, "")       // strip leading slashes
    .replace(/\0/g, "");       // strip null bytes

  const resolved = path.resolve(path.join(OPENCLAW_ROOT, sanitised));

  // Ensure the resolved path is strictly inside OPENCLAW_ROOT
  if (!resolved.startsWith(OPENCLAW_ROOT + path.sep) && resolved !== OPENCLAW_ROOT) {
    return null;
  }

  return resolved;
}

/** Returns true when the resolved path is inside OPENCLAW_ROOT. */
function isPathAllowed(resolvedPath: string): boolean {
  return (
    resolvedPath === OPENCLAW_ROOT ||
    resolvedPath.startsWith(OPENCLAW_ROOT + path.sep)
  );
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface FilesystemOverview {
  installed: boolean;
  rootPath: string;
  gatewayRunning: boolean;
  agentCount: number;
  skillCount: number;
  memoryFileCount: number;
  cronJobCount: number;
  config: OpenClawConfig | null;
}

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface RawFileResponse {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

// ─── Handler helpers ──────────────────────────────────────────────────────────

async function handleOverview(): Promise<NextResponse<FilesystemOverview>> {
  const summary: WorkspaceSummary = await getWorkspaceSummary();
  const overview: FilesystemOverview = {
    installed: summary.installed,
    rootPath: summary.rootPath,
    gatewayRunning: summary.gatewayRunning,
    agentCount: summary.agentCount,
    skillCount: summary.skillCount,
    memoryFileCount: summary.memoryFileCount,
    cronJobCount: summary.cronJobCount,
    config: summary.config,
  };
  return NextResponse.json(overview);
}

async function handleConfig(): Promise<
  NextResponse<OpenClawConfig | { error: string }>
> {
  const config = await readOpenClawConfig();
  if (!config) {
    return NextResponse.json(
      { error: "openclaw.json not found" },
      { status: 404 }
    );
  }
  return NextResponse.json(config);
}

async function handleAgents(): Promise<
  NextResponse<AgentConfig[] | { error: string }>
> {
  try {
    const agents = await readAgentConfigs();
    return NextResponse.json(agents);
  } catch (err) {
    console.error("[/api/filesystem?resource=agents]", err);
    return NextResponse.json(
      { error: "Failed to read agent configurations" },
      { status: 500 }
    );
  }
}

async function handleMemory(
  date: string | null
): Promise<
  NextResponse<
    MemoryEntry[] | { date: string; content: string | null } | { error: string }
  >
> {
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  if (date !== null) {
    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }
    const content = await readDailyMemory(date);
    return NextResponse.json({ date, content });
  }

  try {
    const memories = await readAllMemoryFiles();
    return NextResponse.json(memories);
  } catch (err) {
    console.error("[/api/filesystem?resource=memory]", err);
    return NextResponse.json(
      { error: "Failed to read memory files" },
      { status: 500 }
    );
  }
}

async function handleSkills(): Promise<
  NextResponse<Skill[] | { error: string }>
> {
  try {
    const skills = await readInstalledSkills();
    return NextResponse.json(skills);
  } catch (err) {
    console.error("[/api/filesystem?resource=skills]", err);
    return NextResponse.json(
      { error: "Failed to read skills" },
      { status: 500 }
    );
  }
}

async function handleFile(
  rawPath: string
): Promise<NextResponse<RawFileResponse | { error: string }>> {
  const resolvedPath = safeResolvePath(rawPath);

  if (!resolvedPath || !isPathAllowed(resolvedPath)) {
    return NextResponse.json(
      { error: "Path is outside the allowed directory" },
      { status: 403 }
    );
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(resolvedPath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (stat.isDirectory()) {
    // Return directory listing instead of raw content
    try {
      const names = await fs.readdir(resolvedPath);
      const entries: FileEntry[] = await Promise.all(
        names.map(async (name): Promise<FileEntry> => {
          const childPath = path.join(resolvedPath, name);
          let childStat: Awaited<ReturnType<typeof fs.stat>> | null = null;
          try { childStat = await fs.stat(childPath); } catch { /* ignore */ }
          return {
            path: path.relative(OPENCLAW_ROOT, childPath),
            name,
            isDirectory: childStat?.isDirectory() ?? false,
            size: childStat?.size ?? 0,
            modifiedAt: childStat?.mtime.toISOString() ?? "",
          };
        })
      );
      return NextResponse.json(entries as unknown as RawFileResponse);
    } catch (err) {
      console.error("[/api/filesystem?resource=file] readdir error:", err);
      return NextResponse.json(
        { error: "Failed to list directory" },
        { status: 500 }
      );
    }
  }

  // Enforce a reasonable size cap to avoid sending huge binaries
  const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
  if (stat.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large to return inline (max 1 MB)" },
      { status: 413 }
    );
  }

  try {
    const content = await fs.readFile(resolvedPath, "utf-8");
    const response: RawFileResponse = {
      path: path.relative(OPENCLAW_ROOT, resolvedPath),
      content,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/filesystem?resource=file] read error:", err);
    return NextResponse.json(
      { error: "Failed to read file" },
      { status: 500 }
    );
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const resource = searchParams.get("resource");

  try {
    // All data-returning endpoints first check installation
    if (resource && resource !== "config") {
      const { installed } = await discoverOpenClaw();
      if (!installed) {
        // Return empty payload that matches each resource's expected shape
        if (resource === "agents")  return NextResponse.json([]);
        if (resource === "memory")  return NextResponse.json([]);
        if (resource === "skills")  return NextResponse.json([]);
        if (resource === "file") {
          return NextResponse.json(
            { error: "OpenClaw is not installed" },
            { status: 404 }
          );
        }
      }
    }

    switch (resource) {
      case "config":
        return await handleConfig();

      case "agents":
        return await handleAgents();

      case "memory": {
        const date = searchParams.get("date");
        return await handleMemory(date);
      }

      case "skills":
        return await handleSkills();

      case "file": {
        const filePath = searchParams.get("path");
        if (!filePath || filePath.trim() === "") {
          return NextResponse.json(
            { error: "Missing required query parameter: path" },
            { status: 400 }
          );
        }
        return await handleFile(filePath.trim());
      }

      case "cron": {
        try {
          const cronJobs = await readCronConfigs();
          return NextResponse.json(cronJobs);
        } catch (err) {
          console.error("[/api/filesystem?resource=cron]", err);
          return NextResponse.json(
            { error: "Failed to read cron configurations" },
            { status: 500 }
          );
        }
      }

      default:
        // No resource param → return workspace overview
        return await handleOverview();
    }
  } catch (err) {
    console.error("[/api/filesystem] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

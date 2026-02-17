/**
 * openclaw-discovery.ts
 *
 * Auto-discovery and data-reading layer for a locally installed OpenClaw instance.
 *
 * Responsibilities:
 *  - Detect whether OpenClaw is installed (filesystem + process check)
 *  - Read agent configuration from ~/.openclaw/openclaw.json
 *  - Read agent session logs from ~/.openclaw/agents/*\/sessions/*.jsonl
 *  - Read memory files: SOUL.md, AGENTS.md, workspace daily/*.md
 *  - Read skill definitions from workspace/skills/*\/SKILL.md
 *  - Parse cron schedule configurations
 *  - Calculate cost data from session logs using model pricing tables
 *
 * All functions are safe to call when OpenClaw is NOT installed; they return
 * null / empty arrays instead of throwing.
 *
 * This module is Node.js-only (uses `fs`, `os`, `child_process`).
 */

import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import type { Agent, CostEntry, CronJob, MemoryEntry, Skill } from "@/types";

const execFileAsync = promisify(execFile);

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENCLAW_ROOT = path.join(os.homedir(), ".openclaw");
const WORKSPACE_DIR = path.join(OPENCLAW_ROOT, "workspace");
const AGENTS_DIR = path.join(OPENCLAW_ROOT, "agents");
const GATEWAY_PORT = 18789;

/**
 * Model pricing in USD per 1 000 tokens.
 * Expand as new models are added to OpenClaw.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6":                   { input: 0.015,  output: 0.075  },
  "claude-sonnet-4-5-20250929":        { input: 0.003,  output: 0.015  },
  "claude-sonnet-4-5":                 { input: 0.003,  output: 0.015  },
  "claude-haiku-4-5-20251001":         { input: 0.0008, output: 0.004  },
  "claude-haiku-4-5":                  { input: 0.0008, output: 0.004  },
  "claude-3-5-sonnet-20241022":        { input: 0.003,  output: 0.015  },
  "claude-3-5-haiku-20241022":         { input: 0.0008, output: 0.004  },
  "claude-3-opus-20240229":            { input: 0.015,  output: 0.075  },
  "claude-3-haiku-20240307":           { input: 0.00025,output: 0.00125},
};

const DEFAULT_PRICING = { input: 0.003, output: 0.015 };

// ─── Path helpers ─────────────────────────────────────────────────────────────

function openclawPath(...segments: string[]): string {
  return path.join(OPENCLAW_ROOT, ...segments);
}

function workspacePath(...segments: string[]): string {
  return path.join(WORKSPACE_DIR, ...segments);
}

// ─── Low-level filesystem helpers ─────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
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

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface InstallationInfo {
  /** True when ~/.openclaw/ exists on disk. */
  installed: boolean;
  /** Absolute path to the root directory. */
  rootPath: string;
  /** True when the gateway process is currently listening on its default port. */
  gatewayRunning: boolean;
  /** Paths that were checked during discovery, for debugging. */
  checkedPaths: string[];
}

/**
 * Checks whether a TCP port is accepting connections using `nc` (netcat).
 * Falls back gracefully if nc is not available.
 */
async function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  try {
    await execFileAsync("nc", ["-z", "-w", "1", host, String(port)], {
      timeout: 1500,
    });
    return true;
  } catch {
    // nc not available or port closed
    return false;
  }
}

/**
 * Checks whether a process named "openclaw" (or containing it) is running.
 */
async function isOpenClawProcessRunning(): Promise<boolean> {
  try {
    // pgrep works on macOS and Linux
    const { stdout } = await execFileAsync("pgrep", ["-f", "openclaw"], {
      timeout: 2000,
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Auto-discovers the OpenClaw installation.
 *
 * Checks:
 *  1. ~/.openclaw/ directory exists
 *  2. Gateway port 18789 is open (process running)
 */
export async function discoverOpenClaw(): Promise<InstallationInfo> {
  const checkedPaths = [OPENCLAW_ROOT];

  const installed = await fileExists(OPENCLAW_ROOT);

  let gatewayRunning = false;
  if (installed) {
    // Check port first (fast), then fall back to pgrep
    gatewayRunning =
      (await isPortOpen(GATEWAY_PORT)) ||
      (await isOpenClawProcessRunning());
  }

  return {
    installed,
    rootPath: OPENCLAW_ROOT,
    gatewayRunning,
    checkedPaths,
  };
}

// ─── openclaw.json config ─────────────────────────────────────────────────────

export interface OpenClawConfig {
  version?: string;
  defaultModel?: string;
  gatewayAddress?: string;
  gatewayPort?: number;
  workspacePath?: string;
  logLevel?: string;
  [key: string]: unknown;
}

/**
 * Reads ~/.openclaw/openclaw.json.
 * Also falls back to config.json for backwards compatibility.
 */
export async function readOpenClawConfig(): Promise<OpenClawConfig | null> {
  // Prefer openclaw.json, fall back to config.json
  const candidates = [
    openclawPath("openclaw.json"),
    openclawPath("config.json"),
  ];

  for (const candidate of candidates) {
    const config = await readJsonFile<OpenClawConfig>(candidate);
    if (config !== null) return config;
  }

  return null;
}

// ─── Agent configurations ─────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  model: string;
  capabilities: string[];
  systemPrompt?: string;
  tools?: string[];
  /** Path to the agent's directory inside ~/.openclaw/agents/ */
  dirPath: string;
  [key: string]: unknown;
}

interface RawAgentConfig {
  id?: string;
  name?: string;
  emoji?: string;
  model?: string;
  capabilities?: string[];
  system_prompt?: string;
  systemPrompt?: string;
  tools?: string[];
  [key: string]: unknown;
}

/**
 * Reads all agent configurations from ~/.openclaw/agents/*\/agent.json.
 * Returns an empty array when no agents are configured.
 */
export async function readAgentConfigs(): Promise<AgentConfig[]> {
  const entries = await listDirectory(AGENTS_DIR);
  const configs: AgentConfig[] = [];

  for (const entry of entries) {
    const agentDir = path.join(AGENTS_DIR, entry);
    if (!(await isDirectory(agentDir))) continue;

    // Try both agent.json and openclaw.json inside the agent directory
    const raw =
      (await readJsonFile<RawAgentConfig>(path.join(agentDir, "agent.json"))) ??
      (await readJsonFile<RawAgentConfig>(path.join(agentDir, "openclaw.json")));

    if (!raw) continue;

    configs.push({
      id: raw.id ?? entry,
      name: raw.name ?? entry,
      emoji: raw.emoji ?? "?",
      model: raw.model ?? "unknown",
      capabilities: raw.capabilities ?? [],
      systemPrompt: raw.system_prompt ?? raw.systemPrompt,
      tools: raw.tools,
      dirPath: agentDir,
      ...raw,
    });
  }

  return configs;
}

/**
 * Converts raw AgentConfig entries to the canonical Agent type used by the UI.
 * Runtime stats (uptime, sessionsToday, etc.) are zeroed here; they should be
 * enriched via session-log data if needed.
 */
export async function getAgentsWithStats(): Promise<Agent[]> {
  const configs = await readAgentConfigs();
  const agents: Agent[] = [];

  for (const cfg of configs) {
    // Derive today's session stats from session logs
    const todayStr = new Date().toISOString().split("T")[0];
    const sessions = await readAgentSessionsForDate(cfg.id, todayStr);

    let tokensUsed = 0;
    let costToday = 0;
    for (const s of sessions) {
      tokensUsed += s.inputTokens + s.outputTokens;
      costToday += s.cost;
    }

    agents.push({
      id: cfg.id,
      name: cfg.name,
      emoji: cfg.emoji,
      status: "offline",
      uptime: 0,
      sessionsToday: sessions.length,
      tokensUsed,
      costToday,
      lastActive: new Date().toISOString(),
      capabilities: cfg.capabilities,
      model: cfg.model,
    });
  }

  return agents;
}

// ─── Session logs ─────────────────────────────────────────────────────────────

export interface SessionLogEntry {
  sessionId: string;
  agentId: string;
  timestamp: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface RawSessionEntry {
  session_id?: string;
  sessionId?: string;
  agent_id?: string;
  agentId?: string;
  timestamp?: string;
  role?: string;
  content?: string;
  model?: string;
  input_tokens?: number;
  inputTokens?: number;
  output_tokens?: number;
  outputTokens?: number;
  cost?: number;
  [key: string]: unknown;
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing =
    MODEL_PRICING[model.toLowerCase()] ??
    // Partial match: find the first key that the model string starts with
    Object.entries(MODEL_PRICING).find(([key]) =>
      model.toLowerCase().startsWith(key)
    )?.[1] ??
    DEFAULT_PRICING;

  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

function parseRawSessionEntry(
  raw: RawSessionEntry,
  agentId: string,
  sessionId: string
): SessionLogEntry {
  const inputTokens = raw.input_tokens ?? raw.inputTokens ?? 0;
  const outputTokens = raw.output_tokens ?? raw.outputTokens ?? 0;
  const model = raw.model ?? "unknown";

  const cost =
    raw.cost !== undefined && raw.cost > 0
      ? raw.cost
      : calculateCost(model, inputTokens, outputTokens);

  return {
    sessionId: raw.session_id ?? raw.sessionId ?? sessionId,
    agentId: raw.agent_id ?? raw.agentId ?? agentId,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    role: (raw.role as SessionLogEntry["role"]) ?? "assistant",
    content: raw.content ?? "",
    model,
    inputTokens,
    outputTokens,
    cost,
  };
}

/**
 * Reads all .jsonl session files for a given agent from:
 *   ~/.openclaw/agents/<agentId>/sessions/*.jsonl
 *
 * Returns entries sorted newest-first.
 */
export async function readAgentSessions(
  agentId: string
): Promise<SessionLogEntry[]> {
  const sessionsDir = path.join(AGENTS_DIR, agentId, "sessions");
  const files = await listDirectory(sessionsDir);
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
  const allEntries: SessionLogEntry[] = [];

  for (const file of jsonlFiles) {
    const sessionId = path.basename(file, ".jsonl");
    const raw = await readTextFile(path.join(sessionsDir, file));
    if (!raw) continue;

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as RawSessionEntry;
        allEntries.push(parseRawSessionEntry(entry, agentId, sessionId));
      } catch {
        // Malformed line — skip silently
      }
    }
  }

  return allEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Reads session entries for a specific agent filtered to a single date (YYYY-MM-DD).
 * Useful for computing today's token / cost totals.
 */
async function readAgentSessionsForDate(
  agentId: string,
  date: string
): Promise<SessionLogEntry[]> {
  const all = await readAgentSessions(agentId);
  return all.filter((e) => e.timestamp.startsWith(date));
}

// ─── Memory files ─────────────────────────────────────────────────────────────

/**
 * Reads all known memory files:
 *  - ~/.openclaw/workspace/SOUL.md          (long-term identity)
 *  - ~/.openclaw/workspace/AGENTS.md        (agent roster / notes)
 *  - ~/.openclaw/workspace/daily/YYYY-MM-DD.md  (daily logs)
 *
 * Returns entries sorted newest-first.
 */
export async function readAllMemoryFiles(): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];

  // ── SOUL.md ────────────────────────────────────────────────────────────────
  const soulContent = await readTextFile(workspacePath("SOUL.md"));
  if (soulContent) {
    entries.push({
      id: "soul-md",
      type: "long_term",
      date: new Date().toISOString().split("T")[0],
      content: soulContent.trim(),
      agentId: "system",
      tokens: Math.ceil(soulContent.length / 4),
    });
  }

  // ── AGENTS.md ──────────────────────────────────────────────────────────────
  const agentsContent = await readTextFile(workspacePath("AGENTS.md"));
  if (agentsContent) {
    entries.push({
      id: "agents-md",
      type: "workspace",
      date: new Date().toISOString().split("T")[0],
      content: agentsContent.trim(),
      agentId: "system",
      tokens: Math.ceil(agentsContent.length / 4),
    });
  }

  // ── daily/*.md ─────────────────────────────────────────────────────────────
  const dailyDir = workspacePath("daily");
  const dailyFiles = await listDirectory(dailyDir);
  const mdFiles = dailyFiles
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // newest first

  for (const file of mdFiles) {
    const content = await readTextFile(path.join(dailyDir, file));
    if (!content) continue;

    const dateMatch = file.match(/(\d{4}[-_]?\d{2}[-_]?\d{2})/);
    const rawDate = dateMatch?.[1] ?? file.replace(".md", "");
    const date = rawDate.replace(/[_]/g, "-");

    entries.push({
      id: `daily-${date}`,
      type: "daily",
      date,
      content: content.trim(),
      agentId: "system",
      tokens: Math.ceil(content.length / 4),
    });
  }

  return entries;
}

/**
 * Reads a single daily memory file for the given date (YYYY-MM-DD).
 * Returns null if the file does not exist.
 */
export async function readDailyMemory(date: string): Promise<string | null> {
  const normalized = date.replace(/-/g, "");
  const dailyDir = workspacePath("daily");

  for (const candidate of [`${date}.md`, `${normalized}.md`]) {
    const content = await readTextFile(path.join(dailyDir, candidate));
    if (content !== null) return content;
  }

  return null;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  requires?: { bins?: string[]; env?: string[] };
}

/**
 * Parses YAML-style frontmatter from a SKILL.md / README.md file.
 * Only extracts the simple scalar fields we care about; ignores the rest.
 */
function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};

  const fm: SkillFrontmatter = {};
  const requiresBlock: { bins?: string[]; env?: string[] } = {};

  let inRequires = false;
  let inBins = false;
  let inEnv = false;

  for (const line of fmMatch[1].split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "requires:") { inRequires = true; inBins = false; inEnv = false; continue; }
    if (inRequires && trimmed === "bins:") { inBins = true; inEnv = false; continue; }
    if (inRequires && trimmed === "env:") { inEnv = true; inBins = false; continue; }

    if (inRequires && trimmed.startsWith("- ")) {
      const val = trimmed.slice(2).trim();
      if (inBins) { requiresBlock.bins = [...(requiresBlock.bins ?? []), val]; continue; }
      if (inEnv)  { requiresBlock.env  = [...(requiresBlock.env  ?? []), val]; continue; }
    }

    // Reset depth tracking when we see a top-level key
    if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.includes(":")) {
      inRequires = false; inBins = false; inEnv = false;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const k = trimmed.slice(0, colonIdx).trim();
    const v = trimmed.slice(colonIdx + 1).trim();

    if (k === "name")        fm.name        = v;
    if (k === "description") fm.description = v;
    if (k === "version")     fm.version     = v;
  }

  if (requiresBlock.bins?.length || requiresBlock.env?.length) {
    fm.requires = requiresBlock;
  }

  return fm;
}

/**
 * Reads all skills from ~/.openclaw/workspace/skills/*\/SKILL.md
 * (also checks README.md as a fallback).
 */
export async function readInstalledSkills(): Promise<Skill[]> {
  const skillsDir = workspacePath("skills");
  const entries = await listDirectory(skillsDir);
  const skills: Skill[] = [];

  for (const entry of entries) {
    const skillDir = path.join(skillsDir, entry);
    if (!(await isDirectory(skillDir))) continue;

    const skillContent =
      (await readTextFile(path.join(skillDir, "SKILL.md"))) ??
      (await readTextFile(path.join(skillDir, "README.md")));

    const fm = skillContent ? parseSkillFrontmatter(skillContent) : {};

    skills.push({
      name: fm.name ?? entry,
      description: fm.description ?? "",
      installed: true,
      version: fm.version ?? "0.0.0",
      source: "workspace",
      requires: fm.requires,
    });
  }

  return skills;
}

// ─── Cron parsing ─────────────────────────────────────────────────────────────

/**
 * Attempts to compute the next scheduled run time for a cron expression.
 * Supports the standard 5-field format: minute hour day month weekday.
 * Returns null for complex expressions (ranges, steps, lists) beyond simple cases.
 *
 * NOTE: For production use, replace with a proper cron-parser library.
 */
export function nextCronRunTime(schedule: string): Date | null {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour] = parts;
  const now = new Date();

  const m = minute === "*" ? now.getMinutes() : parseInt(minute, 10);
  const h = hour === "*"   ? now.getHours()   : parseInt(hour,   10);

  if (isNaN(m) || isNaN(h)) return null;

  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(m);
  candidate.setHours(h);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

interface RawCronConfig {
  id?: string;
  name?: string;
  schedule?: string;
  agent?: string;
  agentId?: string;
  agent_id?: string;
  description?: string;
  status?: "active" | "paused" | "error";
  last_run?: string;
  lastRun?: string;
  [key: string]: unknown;
}

/**
 * Reads cron job definitions from:
 *  - ~/.openclaw/openclaw.json  → "cron" array
 *  - ~/.openclaw/cron.json
 *  - ~/.openclaw/workspace/cron.json
 *
 * Returns a normalised array of CronJob objects.
 */
export async function readCronConfigs(): Promise<CronJob[]> {
  const jobs: CronJob[] = [];
  const seenIds = new Set<string>();

  const sources: (RawCronConfig[] | null)[] = [
    // Inline within main config
    await (async () => {
      const cfg = await readOpenClawConfig();
      const arr = cfg?.cron;
      return Array.isArray(arr) ? (arr as RawCronConfig[]) : null;
    })(),
    await readJsonFile<RawCronConfig[]>(openclawPath("cron.json")),
    await readJsonFile<RawCronConfig[]>(workspacePath("cron.json")),
  ];

  let autoIdx = 0;

  for (const source of sources) {
    if (!Array.isArray(source)) continue;

    for (const raw of source) {
      const schedule = raw.schedule ?? "* * * * *";
      const agentId =
        raw.agent_id ?? raw.agentId ?? raw.agent ?? "system";
      const id =
        raw.id ?? `cron-auto-${++autoIdx}`;

      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const lastRunRaw = raw.last_run ?? raw.lastRun;
      const lastRun = lastRunRaw ? new Date(lastRunRaw).toISOString() : undefined;
      const nextRunDate = nextCronRunTime(schedule);
      const nextRun = nextRunDate
        ? nextRunDate.toISOString()
        : new Date(Date.now() + 86_400_000).toISOString();

      jobs.push({
        id,
        name: raw.name ?? id,
        schedule,
        agentId,
        lastRun,
        nextRun,
        status: raw.status ?? "active",
        description: raw.description ?? "",
      });
    }
  }

  return jobs;
}

// ─── Cost data ────────────────────────────────────────────────────────────────

/**
 * Aggregates cost data from two sources (in order of preference):
 *  1. ~/.openclaw/costs.jsonl  (explicit cost log written by the gateway)
 *  2. ~/.openclaw/agents/*\/sessions/*.jsonl  (derived from token counts)
 *
 * Returns entries sorted newest-first.
 */
export async function readAllCostData(): Promise<CostEntry[]> {
  const entries: CostEntry[] = [];

  // ── Source 1: dedicated costs.jsonl ───────────────────────────────────────
  const costsRaw = await readTextFile(openclawPath("costs.jsonl"));
  if (costsRaw) {
    for (const line of costsRaw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as {
          date?: string;
          model?: string;
          input_tokens?: number;
          inputTokens?: number;
          output_tokens?: number;
          outputTokens?: number;
          cost?: number;
          agent_id?: string;
          agentId?: string;
          session_id?: string;
          sessionId?: string;
        };

        const inputTokens  = raw.input_tokens  ?? raw.inputTokens  ?? 0;
        const outputTokens = raw.output_tokens ?? raw.outputTokens ?? 0;
        const model        = raw.model ?? "unknown";
        const cost =
          raw.cost !== undefined && raw.cost > 0
            ? raw.cost
            : calculateCost(model, inputTokens, outputTokens);

        entries.push({
          date:         raw.date ?? new Date().toISOString().split("T")[0],
          model,
          inputTokens,
          outputTokens,
          cost,
          agentId:   raw.agent_id   ?? raw.agentId   ?? "system",
          sessionId: raw.session_id ?? raw.sessionId ?? "",
        });
      } catch {
        // Skip malformed lines
      }
    }
  }

  // ── Source 2: session logs (only if costs.jsonl is empty) ─────────────────
  if (entries.length === 0) {
    const agentDirs = await listDirectory(AGENTS_DIR);

    for (const agentId of agentDirs) {
      const agentDir = path.join(AGENTS_DIR, agentId);
      if (!(await isDirectory(agentDir))) continue;

      const sessions = await readAgentSessions(agentId);

      for (const s of sessions) {
        entries.push({
          date:         s.timestamp.split("T")[0],
          model:        s.model ?? "unknown",
          inputTokens:  s.inputTokens,
          outputTokens: s.outputTokens,
          cost:         s.cost,
          agentId:      s.agentId,
          sessionId:    s.sessionId,
        });
      }
    }
  }

  return entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// ─── Workspace summary ────────────────────────────────────────────────────────

export interface WorkspaceSummary {
  installed: boolean;
  gatewayRunning: boolean;
  rootPath: string;
  config: OpenClawConfig | null;
  agentCount: number;
  skillCount: number;
  memoryFileCount: number;
  cronJobCount: number;
}

/**
 * Returns a high-level summary of the local OpenClaw installation.
 * Useful for the gateway status API endpoint.
 */
export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const discovery = await discoverOpenClaw();

  if (!discovery.installed) {
    return {
      installed: false,
      gatewayRunning: false,
      rootPath: OPENCLAW_ROOT,
      config: null,
      agentCount: 0,
      skillCount: 0,
      memoryFileCount: 0,
      cronJobCount: 0,
    };
  }

  const [config, agents, skills, memories, cronJobs] = await Promise.all([
    readOpenClawConfig(),
    readAgentConfigs(),
    readInstalledSkills(),
    readAllMemoryFiles(),
    readCronConfigs(),
  ]);

  return {
    installed: true,
    gatewayRunning: discovery.gatewayRunning,
    rootPath: OPENCLAW_ROOT,
    config,
    agentCount: agents.length,
    skillCount: skills.length,
    memoryFileCount: memories.length,
    cronJobCount: cronJobs.length,
  };
}

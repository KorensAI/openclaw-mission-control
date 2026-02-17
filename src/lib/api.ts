/**
 * api.ts - Server-side utilities for reading OpenClaw filesystem data.
 *
 * All functions are safe to call when OpenClaw is not installed;
 * they return empty arrays / null instead of throwing.
 *
 * Intended for use in Next.js API route handlers (Node.js runtime only).
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { MemoryEntry, Skill, CostEntry, Agent } from "@/types";

const OPENCLAW_ROOT = path.join(os.homedir(), ".openclaw");

function openclawPath(...segments: string[]): string {
  return path.join(OPENCLAW_ROOT, ...segments);
}

/** Returns true when the OpenClaw root directory exists. */
export async function isOpenClawInstalled(): Promise<boolean> {
  try {
    await fs.access(OPENCLAW_ROOT);
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

export interface OpenClawConfig {
  version?: string;
  defaultModel?: string;
  gatewayAddress?: string;
  [key: string]: unknown;
}

export async function readOpenClawConfig(): Promise<OpenClawConfig | null> {
  return readJsonFile<OpenClawConfig>(openclawPath("config.json"));
}

interface RawAgentConfig {
  id?: string;
  name?: string;
  emoji?: string;
  model?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

export async function readInstalledAgents(): Promise<Partial<Agent>[]> {
  const agentsDir = openclawPath("agents");
  const entries = await listDirectory(agentsDir);
  const agents: Partial<Agent>[] = [];

  for (const entry of entries) {
    const agentDir = path.join(agentsDir, entry);
    const stat = await fs.stat(agentDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const config = await readJsonFile<RawAgentConfig>(
      path.join(agentDir, "agent.json")
    );
    if (!config) continue;

    agents.push({
      id: config.id ?? entry,
      name: config.name ?? entry,
      emoji: config.emoji ?? "?",
      model: config.model ?? "unknown",
      capabilities: config.capabilities ?? [],
    });
  }

  return agents;
}

export interface SessionEntry {
  timestamp: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens?: number;
  cost?: number;
  model?: string;
}

/**
 * Reads all .jsonl session files for a given agent.
 * Returns entries sorted newest-first.
 */
export async function readAgentSessions(agentId: string): Promise<SessionEntry[]> {
  const sessionsDir = openclawPath("agents", agentId, "sessions");
  const files = await listDirectory(sessionsDir);
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));
  const allEntries: SessionEntry[] = [];

  for (const file of jsonlFiles) {
    const raw = await readTextFile(path.join(sessionsDir, file));
    if (!raw) continue;

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as SessionEntry;
        allEntries.push(entry);
      } catch {
        // Malformed line - skip silently
      }
    }
  }

  return allEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Reads daily memory files from ~/.openclaw/workspace/daily/
 * and the long-term SOUL.md file.
 */
export async function readMemoryFiles(): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];

  const dailyDir = openclawPath("workspace", "daily");
  const dailyFiles = await listDirectory(dailyDir);
  const mdFiles = dailyFiles.filter((f) => f.endsWith(".md"));

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

  const soulPath = openclawPath("workspace", "SOUL.md");
  const soulContent = await readTextFile(soulPath);
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

  return entries;
}

export async function readDailyMemory(date: string): Promise<string | null> {
  const normalized = date.replace(/-/g, "");
  const dailyDir = openclawPath("workspace", "daily");
  const candidates = [`${normalized}.md`, `${date}.md`];

  for (const candidate of candidates) {
    const content = await readTextFile(path.join(dailyDir, candidate));
    if (content !== null) return content;
  }

  return null;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  requires?: { bins?: string[]; env?: string[] };
}

function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};

  const fm: SkillFrontmatter = {};
  for (const line of fmMatch[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const k = line.slice(0, colonIdx).trim();
    const v = line.slice(colonIdx + 1).trim();

    if (k === "name") fm.name = v;
    else if (k === "description") fm.description = v;
    else if (k === "version") fm.version = v;
  }
  return fm;
}

export async function getInstalledSkills(): Promise<Skill[]> {
  const skillsDir = openclawPath("workspace", "skills");
  const entries = await listDirectory(skillsDir);
  const skills: Skill[] = [];

  for (const entry of entries) {
    const skillDir = path.join(skillsDir, entry);
    const stat = await fs.stat(skillDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const readmeContent =
      (await readTextFile(path.join(skillDir, "SKILL.md"))) ??
      (await readTextFile(path.join(skillDir, "README.md")));

    const fm = readmeContent ? parseSkillFrontmatter(readmeContent) : {};

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

interface RawCostEntry {
  date?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost?: number;
  agent_id?: string;
  session_id?: string;
  [key: string]: unknown;
}

/** Reads cost/usage data from ~/.openclaw/costs.jsonl (if present). */
export async function getCostData(): Promise<CostEntry[]> {
  const costsPath = openclawPath("costs.jsonl");
  const raw = await readTextFile(costsPath);
  if (!raw) return [];

  const entries: CostEntry[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as RawCostEntry;
      entries.push({
        date: entry.date ?? new Date().toISOString().split("T")[0],
        model: entry.model ?? "unknown",
        inputTokens: entry.input_tokens ?? 0,
        outputTokens: entry.output_tokens ?? 0,
        cost: entry.cost ?? 0,
        agentId: entry.agent_id ?? "system",
        sessionId: entry.session_id ?? "",
      });
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

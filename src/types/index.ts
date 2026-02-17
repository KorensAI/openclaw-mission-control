export type AgentStatus = "online" | "offline" | "busy" | "error";

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: AgentStatus;
  currentTask?: string;
  uptime: number;
  sessionsToday: number;
  tokensUsed: number;
  costToday: number;
  lastActive: string;
  capabilities: string[];
  model: string;
}

export type TaskStatus =
  | "inbox"
  | "assigned"
  | "in_progress"
  | "review"
  | "done"
  | "failed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "critical";
  assignedAgent?: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  estimatedTokens?: number;
  actualTokens?: number;
  cost?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  agentId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface CostEntry {
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  agentId: string;
  sessionId: string;
}

export interface MemoryEntry {
  id: string;
  type: "daily" | "long_term" | "workspace";
  date: string;
  content: string;
  agentId: string;
  tokens: number;
}

export interface Channel {
  id: string;
  type: "telegram" | "discord" | "slack" | "whatsapp" | "webchat" | "signal" | "imessage";
  name: string;
  status: "connected" | "disconnected" | "error";
  lastMessage?: string;
  messageCount: number;
}

export interface GatewayStatus {
  running: boolean;
  version: string;
  uptime: number;
  address: string;
  agents: number;
  channels: number;
  activeSessions: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  lastRun?: string;
  nextRun: string;
  status: "active" | "paused" | "error";
  description: string;
}

export interface Skill {
  name: string;
  description: string;
  installed: boolean;
  version: string;
  source: "bundled" | "workspace" | "clawhub";
  requires?: { bins?: string[]; env?: string[] };
}

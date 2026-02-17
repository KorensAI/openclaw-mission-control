import { create } from "zustand";
import type {
  Agent,
  Task,
  LogEntry,
  CostEntry,
  Channel,
  GatewayStatus,
  CronJob,
  Skill,
  MemoryEntry,
  TaskStatus,
} from "@/types";

interface AppState {
  // Gateway
  gateway: GatewayStatus;
  setGateway: (gateway: Partial<GatewayStatus>) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, data: Partial<Agent>) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void;

  // Logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // Cost
  costEntries: CostEntry[];
  setCostEntries: (entries: CostEntry[]) => void;

  // Channels
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;

  // Cron
  cronJobs: CronJob[];
  setCronJobs: (jobs: CronJob[]) => void;

  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;

  // Memory
  memories: MemoryEntry[];
  setMemories: (memories: MemoryEntry[]) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Gateway
  gateway: {
    running: true,
    version: "1.4.2",
    uptime: 86400,
    address: "ws://127.0.0.1:18789",
    agents: 3,
    channels: 4,
    activeSessions: 2,
    cpuUsage: 12,
    memoryUsage: 34,
  },
  setGateway: (data) =>
    set((s) => ({ gateway: { ...s.gateway, ...data } })),

  // Agents
  agents: [
    {
      id: "agent-1",
      name: "Atlas",
      emoji: "🦞",
      status: "online",
      currentTask: "Processing PR review",
      uptime: 72000,
      sessionsToday: 14,
      tokensUsed: 245000,
      costToday: 3.42,
      lastActive: new Date().toISOString(),
      capabilities: ["code", "browser", "files", "git"],
      model: "claude-sonnet-4-5-20250929",
    },
    {
      id: "agent-2",
      name: "Hermes",
      emoji: "📬",
      status: "busy",
      currentTask: "Sending daily digest via Telegram",
      uptime: 72000,
      sessionsToday: 8,
      tokensUsed: 120000,
      costToday: 1.85,
      lastActive: new Date().toISOString(),
      capabilities: ["messaging", "email", "calendar"],
      model: "claude-haiku-4-5-20251001",
    },
    {
      id: "agent-3",
      name: "Scout",
      emoji: "🔍",
      status: "offline",
      uptime: 0,
      sessionsToday: 0,
      tokensUsed: 0,
      costToday: 0,
      lastActive: new Date(Date.now() - 3600000).toISOString(),
      capabilities: ["browser", "research", "scraping"],
      model: "claude-sonnet-4-5-20250929",
    },
  ],
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, data) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),

  // Tasks
  tasks: [
    {
      id: "task-1",
      title: "Review PR #42 - Auth refactor",
      description: "Review the authentication refactoring PR and provide feedback",
      status: "in_progress",
      priority: "high",
      assignedAgent: "agent-1",
      source: "github",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["code-review", "auth"],
      estimatedTokens: 50000,
      actualTokens: 32000,
    },
    {
      id: "task-2",
      title: "Send weekly expense report",
      description: "Compile and send the weekly expense summary to Telegram",
      status: "in_progress",
      priority: "medium",
      assignedAgent: "agent-2",
      source: "cron",
      createdAt: new Date(Date.now() - 600000).toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["reporting", "scheduled"],
    },
    {
      id: "task-3",
      title: "Scrape competitor pricing data",
      description: "Visit competitor websites and compile pricing comparison",
      status: "inbox",
      priority: "low",
      source: "telegram",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      tags: ["research", "competitive"],
    },
    {
      id: "task-4",
      title: "Fix memory leak in scheduler",
      description: "Investigate and fix the memory leak reported in scheduler service",
      status: "review",
      priority: "critical",
      assignedAgent: "agent-1",
      source: "discord",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      tags: ["bugfix", "scheduler"],
      actualTokens: 78000,
      cost: 1.12,
    },
    {
      id: "task-5",
      title: "Update API documentation",
      description: "Regenerate and update the REST API docs",
      status: "done",
      priority: "medium",
      assignedAgent: "agent-1",
      source: "slack",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      tags: ["docs"],
      actualTokens: 45000,
      cost: 0.64,
    },
  ],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, data) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),
  moveTask: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
      ),
    })),

  // Logs
  logs: Array.from({ length: 30 }, (_, i) => ({
    id: `log-${i}`,
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    level: (["info", "info", "info", "warn", "error", "debug"] as const)[
      Math.floor(Math.random() * 6)
    ],
    agentId: [`agent-1`, `agent-2`, `agent-3`][Math.floor(Math.random() * 3)],
    message: [
      "Processing message from Telegram channel",
      "Tool execution: browser.navigate completed",
      "Session context updated (2,450 tokens)",
      "Rate limit approaching: 85% of quota used",
      "Failed to connect to external API (retrying...)",
      "Skill loaded: code_review v2.1",
      "Memory checkpoint saved",
      "Agent heartbeat OK",
      "Webhook received from GitHub",
      "Cron job triggered: daily_digest",
    ][Math.floor(Math.random() * 10)],
  })),
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs].slice(0, 500) })),
  clearLogs: () => set({ logs: [] }),

  // Cost
  costEntries: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
    model: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"][
      Math.floor(Math.random() * 2)
    ],
    inputTokens: Math.floor(Math.random() * 200000) + 50000,
    outputTokens: Math.floor(Math.random() * 80000) + 10000,
    cost: Math.random() * 5 + 0.5,
    agentId: [`agent-1`, `agent-2`, `agent-3`][Math.floor(Math.random() * 3)],
    sessionId: `session-${Math.floor(Math.random() * 100)}`,
  })),
  setCostEntries: (entries) => set({ costEntries: entries }),

  // Channels
  channels: [
    { id: "ch-1", type: "telegram", name: "Personal Telegram", status: "connected", lastMessage: "Send me the report", messageCount: 342 },
    { id: "ch-2", type: "discord", name: "Dev Server", status: "connected", lastMessage: "!review PR #42", messageCount: 128 },
    { id: "ch-3", type: "slack", name: "Work Workspace", status: "connected", lastMessage: "Update on sprint?", messageCount: 89 },
    { id: "ch-4", type: "whatsapp", name: "WhatsApp", status: "disconnected", messageCount: 0 },
    { id: "ch-5", type: "webchat", name: "Web Interface", status: "connected", lastMessage: "Hello", messageCount: 56 },
  ],
  setChannels: (channels) => set({ channels }),

  // Cron
  cronJobs: [
    { id: "cron-1", name: "Daily Digest", schedule: "0 9 * * *", agentId: "agent-2", lastRun: new Date(Date.now() - 43200000).toISOString(), nextRun: new Date(Date.now() + 43200000).toISOString(), status: "active", description: "Send daily financial summary" },
    { id: "cron-2", name: "Weekly Review", schedule: "0 10 * * 1", agentId: "agent-1", lastRun: new Date(Date.now() - 259200000).toISOString(), nextRun: new Date(Date.now() + 345600000).toISOString(), status: "active", description: "Review and summarize weekly activity" },
    { id: "cron-3", name: "Backup Check", schedule: "0 2 * * *", agentId: "agent-1", lastRun: new Date(Date.now() - 72000000).toISOString(), nextRun: new Date(Date.now() + 14400000).toISOString(), status: "paused", description: "Verify database backups" },
  ],
  setCronJobs: (jobs) => set({ cronJobs: jobs }),

  // Skills
  skills: [
    { name: "code_review", description: "Automated code review with feedback", installed: true, version: "2.1.0", source: "bundled" },
    { name: "browser_automation", description: "Full browser control and scraping", installed: true, version: "1.8.0", source: "bundled" },
    { name: "email_manager", description: "Read, compose, and send emails", installed: true, version: "1.3.0", source: "clawhub" },
    { name: "calendar_sync", description: "Google Calendar integration", installed: false, version: "1.0.0", source: "clawhub" },
    { name: "smart_home", description: "Home Assistant integration", installed: false, version: "0.9.0", source: "clawhub" },
    { name: "git_ops", description: "Advanced git operations and PR management", installed: true, version: "2.0.0", source: "bundled" },
    { name: "file_manager", description: "Local file system operations", installed: true, version: "1.5.0", source: "bundled" },
    { name: "accounting", description: "Financial document processing and tracking", installed: true, version: "1.0.0", source: "workspace" },
  ],
  setSkills: (skills) => set({ skills }),

  // Memory
  memories: Array.from({ length: 10 }, (_, i) => ({
    id: `mem-${i}`,
    type: (["daily", "long_term", "workspace"] as const)[Math.floor(Math.random() * 3)],
    date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0],
    content: [
      "User prefers concise responses. Timezone: Asia/Jerusalem.",
      "Project uses Next.js 14 with App Router. Database is Google Sheets.",
      "The accounting system processes invoices via OCR + Claude API.",
      "User wants Telegram notifications for all payment reminders.",
      "Weekly reports should be sent Monday 10 AM Israel time.",
    ][Math.floor(Math.random() * 5)],
    agentId: [`agent-1`, `agent-2`, `agent-3`][Math.floor(Math.random() * 3)],
    tokens: Math.floor(Math.random() * 2000) + 200,
  })),
  setMemories: (memories) => set({ memories }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

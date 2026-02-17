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
  // Hydration
  hydrated: boolean;
  hydrate: () => Promise<void>;

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

export const useStore = create<AppState>((set, get) => ({
  // Hydration — fetches real data from API endpoints and replaces defaults
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;

    try {
      const [gatewayRes, agentsRes, skillsRes, memoryRes, costsRes, logsRes, cronRes] = await Promise.allSettled([
        fetch("/api/gateway"),
        fetch("/api/gateway?resource=agents"),
        fetch("/api/skills"),
        fetch("/api/memory"),
        fetch("/api/costs"),
        fetch("/api/logs"),
        fetch("/api/cron"),
      ]);

      if (gatewayRes.status === "fulfilled" && gatewayRes.value.ok) {
        const gw: GatewayStatus = await gatewayRes.value.json();
        set({ gateway: gw });
      }

      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        const agents: Agent[] = await agentsRes.value.json();
        if (Array.isArray(agents)) set({ agents });
      }

      if (skillsRes.status === "fulfilled" && skillsRes.value.ok) {
        const skills: Skill[] = await skillsRes.value.json();
        if (Array.isArray(skills)) set({ skills });
      }

      if (memoryRes.status === "fulfilled" && memoryRes.value.ok) {
        const memories: MemoryEntry[] = await memoryRes.value.json();
        if (Array.isArray(memories)) set({ memories });
      }

      if (costsRes.status === "fulfilled" && costsRes.value.ok) {
        const costEntries: CostEntry[] = await costsRes.value.json();
        if (Array.isArray(costEntries)) set({ costEntries });
      }

      if (logsRes.status === "fulfilled" && logsRes.value.ok) {
        const logs: LogEntry[] = await logsRes.value.json();
        if (Array.isArray(logs)) set({ logs });
      }

      if (cronRes.status === "fulfilled" && cronRes.value.ok) {
        const cronJobs: CronJob[] = await cronRes.value.json();
        if (Array.isArray(cronJobs)) set({ cronJobs });
      }
    } catch {
      // Hydration failed — keep defaults (empty)
    }

    set({ hydrated: true });
  },

  // Gateway — empty defaults until hydrated
  gateway: {
    running: false,
    version: "unknown",
    uptime: 0,
    address: "ws://127.0.0.1:18789",
    agents: 0,
    channels: 0,
    activeSessions: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  },
  setGateway: (data) =>
    set((s) => ({ gateway: { ...s.gateway, ...data } })),

  // Agents — empty until hydrated
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgent: (id, data) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...data } : a)),
    })),

  // Tasks — empty until hydrated (no API for tasks yet, so starts empty)
  tasks: [],
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

  // Logs — empty until populated at runtime
  logs: [],
  addLog: (log) => set((s) => ({ logs: [log, ...s.logs].slice(0, 500) })),
  clearLogs: () => set({ logs: [] }),

  // Cost — empty until hydrated
  costEntries: [],
  setCostEntries: (entries) => set({ costEntries: entries }),

  // Channels — empty until hydrated (no API for channels yet, so starts empty)
  channels: [],
  setChannels: (channels) => set({ channels }),

  // Cron — empty until hydrated (no API for cron yet, so starts empty)
  cronJobs: [],
  setCronJobs: (jobs) => set({ cronJobs: jobs }),

  // Skills — empty until hydrated
  skills: [],
  setSkills: (skills) => set({ skills }),

  // Memory — empty until hydrated
  memories: [],
  setMemories: (memories) => set({ memories }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
}));

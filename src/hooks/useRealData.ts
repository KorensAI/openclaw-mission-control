"use client";

/**
 * useRealData - React hooks that fetch live OpenClaw data from API routes.
 * Falls back to Zustand mock data when OpenClaw is not installed.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Agent, MemoryEntry, Skill, GatewayStatus } from "@/types";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when data came from the live API (not mock store). */
  fromRealData: boolean;
}

function useFetch<T>(
  url: string | null,
  options?: { pollInterval?: number }
): FetchState<T> & { refresh: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: url !== null,
    error: null,
    fromRealData: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (url === null) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ` + String(res.status) + `: ` + res.statusText);
      const data = (await res.json()) as T;
      setState({ data, loading: false, error: null, fromRealData: true });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Fetch failed",
        fromRealData: false,
      }));
    }
  }, [url]);

  useEffect(() => {
    if (url === null) return;
    void fetchData();
    if (options?.pollInterval && options.pollInterval > 0) {
      pollRef.current = setInterval(() => void fetchData(), options.pollInterval);
    }
    return () => {
      abortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  return { ...state, refresh: fetchData };
}

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
  fromRealData: boolean;
  refresh: () => void;
}

/** Returns the list of agents. Uses real data when available; falls back to mock. */
export function useAgents(): UseAgentsReturn {
  const mockAgents = useStore((s) => s.agents);
  const { data: realAgents, loading, error, fromRealData, refresh } =
    useFetch<Agent[]>("/api/agents", { pollInterval: 30_000 });
  const agents = fromRealData && Array.isArray(realAgents) && realAgents.length > 0
    ? realAgents : mockAgents;
  return { agents, loading, error, fromRealData, refresh };
}

interface UseMemoriesReturn {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;
  fromRealData: boolean;
  refresh: () => void;
}

export function useMemories(): UseMemoriesReturn {
  const mockMemories = useStore((s) => s.memories);
  const { data: realMemories, loading, error, fromRealData, refresh } =
    useFetch<MemoryEntry[]>("/api/memory");
  const memories = fromRealData && Array.isArray(realMemories) && realMemories.length > 0
    ? realMemories : mockMemories;
  return { memories, loading, error, fromRealData, refresh };
}

interface UseSkillsReturn {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  fromRealData: boolean;
  refresh: () => void;
}

export function useSkills(): UseSkillsReturn {
  const mockSkills = useStore((s) => s.skills);
  const { data: realSkills, loading, error, fromRealData, refresh } =
    useFetch<Skill[]>("/api/skills");
  const skills = fromRealData && Array.isArray(realSkills) && realSkills.length > 0
    ? realSkills : mockSkills;
  return { skills, loading, error, fromRealData, refresh };
}

export interface SessionEntry {
  timestamp: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens?: number;
  cost?: number;
  model?: string;
}

interface UseSessionsReturn {
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  fromRealData: boolean;
  refresh: () => void;
}

/**
 * useSessions - Fetches session history for a given agent.
 * Returns empty array when agentId is not provided.
 */
export function useSessions(agentId?: string): UseSessionsReturn {
  const url = agentId ? `/api/sessions?agentId=` + encodeURIComponent(agentId) : null;
  const { data: realSessions, loading, error, fromRealData, refresh } =
    useFetch<SessionEntry[]>(url);
  return {
    sessions: realSessions ?? [],
    loading: url !== null ? loading : false,
    error,
    fromRealData,
    refresh,
  };
}

interface UseGatewayStatusReturn {
  status: GatewayStatus | null;
  loading: boolean;
  error: string | null;
  fromRealData: boolean;
  refresh: () => void;
}

/** Polls the gateway status API every 10 seconds. Falls back to Zustand mock. */
export function useGatewayStatus(): UseGatewayStatusReturn {
  const mockGateway = useStore((s) => s.gateway);
  const { data: realStatus, loading, error, fromRealData, refresh } =
    useFetch<GatewayStatus>("/api/gateway/status", { pollInterval: 10_000 });
  const status: GatewayStatus = fromRealData && realStatus ? realStatus : mockGateway;
  return { status, loading, error, fromRealData, refresh };
}

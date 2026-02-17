"use client";

/**
 * gateway-hooks.ts - React hooks that wrap the OpenClaw WebSocket gateway.
 *
 * Hooks exported:
 *   useGatewayConnection()  - connection status + connect/disconnect controls
 *   useGatewayEvents()      - subscribe to a specific typed event stream
 *   useAutoSync()           - bridge incoming gateway events → Zustand store
 *
 * All hooks are client-only ("use client") and safe to call on SSR pages
 * because the underlying GatewayConnection guards against WebSocket in Node.js.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { gateway } from "@/lib/gateway";
import type {
  GatewayEventType,
  GatewayEventMap,
  GatewayConnectionStatus,
} from "@/lib/gateway";
import { useStore } from "@/lib/store";
import type {
  Agent,
  Task,
  LogEntry,
  CostEntry,
} from "@/types";

// ---------------------------------------------------------------------------
// useGatewayConnection
// ---------------------------------------------------------------------------

export interface UseGatewayConnectionReturn {
  /** True when the WebSocket is in the OPEN state. */
  connected: boolean;
  /** Current state machine value. */
  connectionState: GatewayConnectionStatus["state"];
  /** Number of reconnect attempts since the last successful connection. */
  reconnectAttempts: number;
  /** Open the WebSocket connection. */
  connect: () => void;
  /** Close the WebSocket connection and stop auto-reconnect. */
  disconnect: () => void;
  /** Full status snapshot from the gateway singleton. */
  status: GatewayConnectionStatus;
}

/**
 * Returns connection state and connect/disconnect controls.
 * Does NOT automatically connect on mount - call connect() explicitly,
 * or use useAutoSync() which connects automatically.
 */
export function useGatewayConnection(): UseGatewayConnectionReturn {
  const [status, setStatus] = useState<GatewayConnectionStatus>(
    gateway.getStatus()
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const refresh = () => {
      if (mountedRef.current) {
        setStatus(gateway.getStatus());
      }
    };

    const unsubs = [
      gateway.on("connect", refresh),
      gateway.on("disconnect", refresh),
      gateway.on("reconnecting", refresh),
      gateway.on("state_change", refresh),
      gateway.on("error", refresh),
      gateway.on("reconnect_failed", refresh),
    ];

    return () => {
      mountedRef.current = false;
      for (const unsub of unsubs) unsub();
    };
  }, []);

  const connect = useCallback(() => {
    gateway.connect();
  }, []);

  const disconnect = useCallback(() => {
    gateway.disconnect();
  }, []);

  return {
    connected: status.connected,
    connectionState: status.state,
    reconnectAttempts: status.reconnectAttempts,
    connect,
    disconnect,
    status,
  };
}

// ---------------------------------------------------------------------------
// useGatewayEvents
// ---------------------------------------------------------------------------

export interface UseGatewayEventsReturn<K extends GatewayEventType> {
  /** The most recently received event payload, or null if none yet. */
  lastEvent: GatewayEventMap[K] | null;
  /** All received events in newest-first order (capped at maxEvents). */
  events: GatewayEventMap[K][];
  /** Manually clear the accumulated event list. */
  clearEvents: () => void;
}

/**
 * Subscribes to a specific gateway event type and returns the event stream.
 *
 * @param eventType  One of the typed OpenClaw event names (e.g. "agent.status").
 * @param maxEvents  Maximum number of events to keep in memory (default 200).
 *
 * Example:
 *   const { lastEvent } = useGatewayEvents("agent.status");
 *   if (lastEvent) console.log(lastEvent.agentId, lastEvent.status);
 */
export function useGatewayEvents<K extends GatewayEventType>(
  eventType: K,
  maxEvents = 200
): UseGatewayEventsReturn<K> {
  type Payload = GatewayEventMap[K];

  const [events, setEvents] = useState<Payload[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const unsub = gateway.onEvent(eventType, (payload) => {
      if (!mountedRef.current) return;
      setEvents((prev) => [payload, ...prev].slice(0, maxEvents) as Payload[]);
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [eventType, maxEvents]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return {
    lastEvent: events[0] ?? null,
    events,
    clearEvents,
  };
}

// ---------------------------------------------------------------------------
// useAutoSync
// ---------------------------------------------------------------------------

export interface UseAutoSyncReturn {
  /** True when the WebSocket is currently connected. */
  connected: boolean;
  /** Current reconnect attempt count. */
  reconnectAttempts: number;
  /** Manually trigger a reconnect if the connection has dropped. */
  reconnect: () => void;
}

/**
 * Connects to the gateway on mount and automatically bridges all incoming
 * events to the Zustand store.  Place this hook once near the top of the
 * component tree (e.g. in a layout or provider component).
 *
 * Handled event → store action mappings:
 *   agent.status    → store.updateAgent(agentId, changes)
 *   task.created    → store.addTask(task)
 *   task.updated    → store.updateTask(taskId, changes)
 *   log.entry       → store.addLog(entry)
 *   cost.update     → store.setCostEntries([...prev, entry])
 *   session.start   → store.setGateway({ activeSessions: n + 1 })
 *   session.end     → store.setGateway({ activeSessions: n - 1 })
 *   cron.triggered  → store.setCronJobs([updated job, ...rest])
 */
export function useAutoSync(): UseAutoSyncReturn {
  const [connected, setConnected] = useState(gateway.isConnected);
  const [reconnectAttempts, setReconnectAttempts] = useState(
    gateway.reconnectCount
  );
  const mountedRef = useRef(true);

  // Pull store actions once - these are stable references from Zustand.
  const updateAgent = useStore((s) => s.updateAgent);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const addLog = useStore((s) => s.addLog);
  const setGateway = useStore((s) => s.setGateway);
  const setCostEntries = useStore((s) => s.setCostEntries);
  const setCronJobs = useStore((s) => s.setCronJobs);
  // Read current state values for delta operations.
  const currentCostEntries = useStore((s) => s.costEntries);
  const currentCronJobs = useStore((s) => s.cronJobs);
  const currentGateway = useStore((s) => s.gateway);

  // Stable refs so event handlers don't stale-close over old store values.
  const costEntriesRef = useRef<CostEntry[]>(currentCostEntries);
  const cronJobsRef = useRef(currentCronJobs);
  const activeSessions = useRef(currentGateway.activeSessions);

  useEffect(() => {
    costEntriesRef.current = currentCostEntries;
  }, [currentCostEntries]);

  useEffect(() => {
    cronJobsRef.current = currentCronJobs;
  }, [currentCronJobs]);

  useEffect(() => {
    activeSessions.current = currentGateway.activeSessions;
  }, [currentGateway.activeSessions]);

  useEffect(() => {
    mountedRef.current = true;

    // Connect on mount.
    gateway.connect();

    // -----------------------------------------------------------------------
    // Lifecycle listeners
    // -----------------------------------------------------------------------
    const unsubs: Array<() => void> = [
      gateway.on("connect", () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setReconnectAttempts(0);
        setGateway({ running: true });
      }),

      gateway.on("disconnect", () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setGateway({ running: false });
      }),

      gateway.on("reconnecting", (raw) => {
        if (!mountedRef.current) return;
        const data = raw as { attempt?: number };
        setReconnectAttempts(data?.attempt ?? 0);
      }),

      // -----------------------------------------------------------------------
      // Domain event listeners → Zustand store
      // -----------------------------------------------------------------------

      // agent.status  →  updateAgent
      gateway.onEvent("agent.status", (payload) => {
        if (!mountedRef.current) return;
        const { agentId, ...changes } = payload;
        updateAgent(agentId, changes as Partial<Agent>);
      }),

      // task.created  →  addTask
      gateway.onEvent("task.created", (payload) => {
        if (!mountedRef.current) return;
        addTask(payload.task);
      }),

      // task.updated  →  updateTask
      gateway.onEvent("task.updated", (payload) => {
        if (!mountedRef.current) return;
        updateTask(payload.taskId, payload.changes as Partial<Task>);
      }),

      // log.entry  →  addLog
      gateway.onEvent("log.entry", (payload) => {
        if (!mountedRef.current) return;
        addLog(payload.entry as LogEntry);
      }),

      // session.start  →  increment activeSessions counter
      gateway.onEvent("session.start", () => {
        if (!mountedRef.current) return;
        const next = activeSessions.current + 1;
        activeSessions.current = next;
        setGateway({ activeSessions: next });
      }),

      // session.end  →  decrement activeSessions counter (floor at 0)
      gateway.onEvent("session.end", () => {
        if (!mountedRef.current) return;
        const next = Math.max(0, activeSessions.current - 1);
        activeSessions.current = next;
        setGateway({ activeSessions: next });
      }),

      // cron.triggered  →  update the matching cron job's lastRun field
      gateway.onEvent("cron.triggered", (payload) => {
        if (!mountedRef.current) return;
        const updatedJobs = cronJobsRef.current.map((job) =>
          job.id === payload.jobId
            ? { ...job, lastRun: payload.triggeredAt }
            : job
        );
        cronJobsRef.current = updatedJobs;
        setCronJobs(updatedJobs);
      }),

      // cost.update  →  append to cost entries (cap at 500 entries)
      gateway.onEvent("cost.update", (payload) => {
        if (!mountedRef.current) return;
        const next = [payload.entry, ...costEntriesRef.current].slice(0, 500);
        costEntriesRef.current = next;
        setCostEntries(next);
      }),
    ];

    return () => {
      mountedRef.current = false;
      for (const unsub of unsubs) unsub();
      // Do NOT call gateway.disconnect() here - the connection is shared
      // across the whole app and should outlive any single component.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    updateAgent,
    addTask,
    updateTask,
    addLog,
    setGateway,
    setCostEntries,
    setCronJobs,
  ]);

  const reconnect = useCallback(() => {
    gateway.connect();
  }, []);

  return { connected, reconnectAttempts, reconnect };
}

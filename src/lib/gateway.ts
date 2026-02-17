/**
 * gateway.ts - WebSocket connection layer for the OpenClaw Mission Control.
 *
 * Implements:
 *  - GatewayConnection class connecting to ws://127.0.0.1:18789
 *  - Exponential backoff reconnection with jitter
 *  - Typed event parsing for all OpenClaw event types
 *  - Heartbeat (ping/pong) to detect stale connections
 *  - Graceful shutdown (no reconnect after explicit disconnect)
 *  - Singleton export for use across the app
 *
 * Uses the browser-native WebSocket API (runs client-side only).
 */

import type {
  Agent,
  Task,
  LogEntry,
  CostEntry,
  CronJob,
} from "@/types";

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

export interface AgentStatusPayload {
  agentId: string;
  status: Agent["status"];
  currentTask?: string;
  tokensUsed?: number;
  costToday?: number;
  lastActive?: string;
}

export interface TaskCreatedPayload {
  task: Task;
}

export interface TaskUpdatedPayload {
  taskId: string;
  changes: Partial<Task>;
}

export interface LogEntryPayload {
  entry: LogEntry;
}

export interface SessionStartPayload {
  sessionId: string;
  agentId: string;
  startedAt: string;
  model?: string;
}

export interface SessionEndPayload {
  sessionId: string;
  agentId: string;
  endedAt: string;
  totalTokens?: number;
  totalCost?: number;
}

export interface CronTriggeredPayload {
  jobId: string;
  job: CronJob;
  triggeredAt: string;
}

export interface CostUpdatePayload {
  entry: CostEntry;
  agentId: string;
}

/** Union of all strongly-typed event payloads keyed by event type. */
export type GatewayEventMap = {
  "agent.status": AgentStatusPayload;
  "task.created": TaskCreatedPayload;
  "task.updated": TaskUpdatedPayload;
  "log.entry": LogEntryPayload;
  "session.start": SessionStartPayload;
  "session.end": SessionEndPayload;
  "cron.triggered": CronTriggeredPayload;
  "cost.update": CostUpdatePayload;
  // Internal lifecycle events
  connect: { url: string };
  disconnect: { intentional: boolean; code?: number; reason?: string; wasConnected?: boolean };
  reconnecting: { attempt: number; delay: number };
  reconnect_failed: { attempts: number };
  heartbeat_timeout: Record<string, never>;
  state_change: { state: ConnectionState };
  error: { event?: Event; error?: unknown };
  message: GatewayMessage;
  raw_message: { data: unknown };
};

export type GatewayEventType = keyof GatewayEventMap;

type Listener<T = unknown> = (payload: T) => void;
// Internal map allows any-typed callbacks for the generic listener registry.
type AnyListener = Listener<unknown>;

// ---------------------------------------------------------------------------
// Raw wire format
// ---------------------------------------------------------------------------

export interface GatewayMessage {
  type: string;
  payload?: unknown;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Connection states
// ---------------------------------------------------------------------------

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface GatewayConnectionStatus {
  state: ConnectionState;
  connected: boolean;
  reconnectAttempts: number;
  url: string;
}

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

const GATEWAY_URL = "ws://127.0.0.1:18789";
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ---------------------------------------------------------------------------
// GatewayConnection
// ---------------------------------------------------------------------------

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Map<string, Set<AnyListener>>();
  private state: ConnectionState = "disconnected";

  constructor(
    url: string = GATEWAY_URL,
    maxReconnectAttempts: number = MAX_RECONNECT_ATTEMPTS
  ) {
    this.url = url;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Open the WebSocket connection. No-op if already connected or connecting. */
  connect(): void {
    if (this.state === "connected" || this.state === "connecting") return;
    // Guard: WebSocket is not available in Node.js (SSR) environments.
    if (typeof WebSocket === "undefined") return;
    this.intentionalDisconnect = false;
    this._openSocket();
  }

  /** Close the connection and suppress any future reconnect attempts. */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this._clearReconnectTimer();
    this._clearHeartbeat();
    this._setState("disconnected");
    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
    this._emit("disconnect", { intentional: true });
  }

  /**
   * Send a typed message to the gateway.
   * Silently logs a warning (rather than throwing) when not connected,
   * so callers don't need to guard every send().
   */
  send(type: string, payload?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "GatewayConnection: cannot send '" + type + "' - socket is not connected (state: " + this.state + ")"
      );
      return;
    }
    const message: GatewayMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Subscribe to a typed gateway event.
   * Returns an unsubscribe function.
   *
   * Usage:
   *   const unsub = gateway.onEvent("agent.status", (payload) => { ... });
   *   // later:
   *   unsub();
   */
  onEvent<K extends GatewayEventType>(
    eventType: K,
    callback: Listener<GatewayEventMap[K]>
  ): () => void {
    return this._on(eventType, callback as AnyListener);
  }

  /**
   * Generic listener registration (also used internally).
   * Prefer onEvent() for typed subscriptions.
   */
  on(event: string, callback: AnyListener): () => void {
    return this._on(event, callback);
  }

  /** Current connection status snapshot. */
  getStatus(): GatewayConnectionStatus {
    return {
      state: this.state,
      connected: this.state === "connected",
      reconnectAttempts: this.reconnectAttempts,
      url: this.url,
    };
  }

  // Convenience getters (kept for backward compat with existing hooks).
  get isConnected(): boolean {
    return this.state === "connected";
  }
  get connectionState(): ConnectionState {
    return this.state;
  }
  get reconnectCount(): number {
    return this.reconnectAttempts;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _on(event: string, callback: AnyListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private _openSocket(): void {
    this._setState("connecting");
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this._setState("connected");
        this._startHeartbeat();
        this._emit("connect", { url: this.url });
      };

      ws.onmessage = (event: MessageEvent) => {
        this._handleMessage(event);
      };

      ws.onerror = (event: Event) => {
        this._setState("error");
        this._emit("error", { event });
      };

      ws.onclose = (event: CloseEvent) => {
        this._clearHeartbeat();
        this.ws = null;
        const wasConnected = this.state === "connected";
        this._setState("disconnected");
        this._emit("disconnect", {
          intentional: this.intentionalDisconnect,
          code: event.code,
          reason: event.reason,
          wasConnected,
        });
        if (!this.intentionalDisconnect) {
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      this._setState("error");
      this._emit("error", { error: err });
      if (!this.intentionalDisconnect) {
        this._scheduleReconnect();
      }
    }
  }

  private _handleMessage(event: MessageEvent): void {
    let parsed: GatewayMessage;
    try {
      parsed = JSON.parse(event.data as string) as GatewayMessage;
    } catch {
      this._emit("raw_message", { data: event.data });
      return;
    }

    // Handle pong internally - clear the heartbeat timeout.
    if (parsed.type === "pong") {
      this._clearHeartbeatTimeout();
      return;
    }

    // Emit on the specific event type channel (e.g. "agent.status").
    this._emit(parsed.type, parsed.payload);
    // Also emit on the generic "message" channel with the full envelope.
    this._emit("message", parsed);
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this._emit("reconnect_failed", { attempts: this.reconnectAttempts });
      return;
    }
    this.reconnectAttempts += 1;
    const base = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );
    const jitter = Math.random() * 500;
    const delay = base + jitter;
    this._emit("reconnecting", { attempt: this.reconnectAttempts, delay });
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalDisconnect) this._openSocket();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        return;
      }
      this.heartbeatTimeoutTimer = setTimeout(() => {
        this._emit("heartbeat_timeout", {});
        this.ws?.close(1001, "Heartbeat timeout");
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this._clearHeartbeatTimeout();
  }

  private _clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private _setState(state: ConnectionState): void {
    this.state = state;
    this._emit("state_change", { state });
  }

  private _emit(event: string, payload: unknown): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error("GatewayConnection: listener error for event '" + event + "'", err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton - SSR safe (WebSocket guard inside connect()).
// ---------------------------------------------------------------------------
export const gateway = new GatewayConnection();

// Re-export the old class name for backward compatibility with existing imports.
export { GatewayConnection as GatewayClient };

// GatewayMessage is already exported above as an interface.

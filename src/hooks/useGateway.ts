"use client";

// useGateway - React hook for the OpenClaw WebSocket gateway.

import { useEffect, useState, useCallback, useRef } from "react";
import { gateway, type GatewayMessage } from "@/lib/gateway";

interface UseGatewayReturn {
  connected: boolean;
  reconnectCount: number;
  sendMessage: (agentId: string, message: string) => void;
  sendCommand: (type: string, payload?: unknown) => void;
  subscribe: (event: string, callback: (payload: unknown) => void) => () => void;
  gateway: typeof gateway;
}

export function useGateway(): UseGatewayReturn {
  const [connected, setConnected] = useState(gateway.isConnected);
  const [reconnectCount, setReconnectCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    gateway.connect();
    const unsubs = [
      gateway.on("connect", () => {
        if (mountedRef.current) { setConnected(true); setReconnectCount(0); }
      }),
      gateway.on("disconnect", () => {
        if (mountedRef.current) setConnected(false);
      }),
      gateway.on("reconnecting", (data: unknown) => {
        if (mountedRef.current) {
          const d = data as { attempt?: number };
          setReconnectCount(d?.attempt ?? 0);
        }
      }),
      gateway.on("state_change", () => {
        if (mountedRef.current) setConnected(gateway.isConnected);
      }),
    ];
    return () => {
      mountedRef.current = false;
      for (const unsub of unsubs) (unsub as () => void)();
    };
  }, []);

  const sendMessage = useCallback((agentId: string, message: string) => {
    if (!gateway.isConnected) {
      console.warn("useGateway: cannot send - not connected");
      return;
    }
    try { gateway.send("chat", { agentId, message }); }
    catch (err) { console.error("useGateway: sendMessage failed", err); }
  }, []);

  const sendCommand = useCallback((type: string, payload?: unknown) => {
    if (!gateway.isConnected) {
      console.warn("useGateway: cannot send command - not connected");
      return;
    }
    try { gateway.send(type, payload); }
    catch (err) { console.error("useGateway: sendCommand failed", err); }
  }, []);

  const subscribe = useCallback(
    (event: string, callback: (payload: unknown) => void): (() => void) =>
      gateway.on(event, callback) as () => void,
    []
  );

  return { connected, reconnectCount, sendMessage, sendCommand, subscribe, gateway };
}

interface UseGatewayMessagesReturn {
  messages: GatewayMessage[];
  clearMessages: () => void;
}

// Collects incoming gateway messages into a state array.
export function useGatewayMessages(
  filterType?: string,
  maxMessages = 200
): UseGatewayMessagesReturn {
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  useEffect(() => {
    const event = filterType ?? "message";
    const unsub = gateway.on(event, (data: unknown) => {
      const msg = (filterType
        ? { type: filterType, payload: data, timestamp: new Date().toISOString() }
        : data) as GatewayMessage;
      setMessages((prev) => [msg, ...prev].slice(0, maxMessages));
    });
    return () => (unsub as () => void)();
  }, [filterType, maxMessages]);
  const clearMessages = useCallback(() => setMessages([]), []);
  return { messages, clearMessages };
}

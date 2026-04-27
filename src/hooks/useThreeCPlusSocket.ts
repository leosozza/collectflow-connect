import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Realtime Socket.IO hook for 3CPLUS.
 *
 * - Singleton per tenant.id (avoids duplicate connections across components).
 * - Reconnects automatically (exponential backoff handled by socket.io-client).
 * - Never logs api_token.
 * - Returns a small, stable API that consumers can safely depend on.
 *
 * The official 3CPLUS realtime endpoint is `https://socket.3c.plus/`.
 * Auth shape may vary per provider release — we send token in BOTH `auth`
 * and `query` to maximize compat. The socket layer only sees opaque values.
 */

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export interface ThreeCPlusSocketState {
  status: SocketStatus;
  lastEventAt: Date | null;
  lastEventName: string | null;
  errorMessage: string | null;
}

type Listener = (payload: any, eventName: string) => void;

interface SharedConn {
  socket: Socket;
  listeners: Map<string, Set<Listener>>;
  anyListeners: Set<Listener>;
  refCount: number;
  state: ThreeCPlusSocketState;
  subscribers: Set<(s: ThreeCPlusSocketState) => void>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const conns = new Map<string, SharedConn>();

function notify(conn: SharedConn) {
  for (const sub of conn.subscribers) sub({ ...conn.state });
}

function buildEndpoint() {
  // 3CPLUS unified realtime endpoint
  return "https://socket.3c.plus/";
}

function cleanDomainOf(domain: string) {
  return (domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function getOrCreateConn(key: string, domain: string, apiToken: string): SharedConn {
  const existing = conns.get(key);
  if (existing) {
    if (existing.cleanupTimer) {
      clearTimeout(existing.cleanupTimer);
      existing.cleanupTimer = null;
    }
    return existing;
  }

  const cleanDomain = cleanDomainOf(domain);
  const endpoint = buildEndpoint();

  const socket = io(endpoint, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    timeout: 12000,
    auth: { token: apiToken, company: cleanDomain },
    query: { token: apiToken, company: cleanDomain },
  });

  const conn: SharedConn = {
    socket,
    listeners: new Map(),
    anyListeners: new Set(),
    refCount: 0,
    state: { status: "connecting", lastEventAt: null, lastEventName: null, errorMessage: null },
    subscribers: new Set(),
    cleanupTimer: null,
  };

  socket.on("connect", () => {
    conn.state = { ...conn.state, status: "connected", errorMessage: null };
    notify(conn);
  });
  socket.on("disconnect", (reason) => {
    conn.state = { ...conn.state, status: reason === "io client disconnect" ? "disconnected" : "reconnecting" };
    notify(conn);
  });
  socket.io.on("reconnect_attempt", () => {
    conn.state = { ...conn.state, status: "reconnecting" };
    notify(conn);
  });
  socket.io.on("error", (err: Error) => {
    conn.state = { ...conn.state, status: "error", errorMessage: err?.message || "Erro de socket" };
    notify(conn);
  });
  socket.on("connect_error", (err: Error) => {
    // Do not log token; just message
    // eslint-disable-next-line no-console
    console.warn("[3CPlusSocket] connect_error:", err?.message);
    conn.state = { ...conn.state, status: "error", errorMessage: err?.message || "Falha na conexão" };
    notify(conn);
  });

  // Generic event hook (Socket.IO v4 supports onAny)
  socket.onAny((eventName: string, payload: any) => {
    conn.state = { ...conn.state, lastEventAt: new Date(), lastEventName: eventName };
    notify(conn);
    const handlers = conn.listeners.get(eventName);
    if (handlers) {
      for (const h of handlers) {
        try { h(payload, eventName); } catch (e) { /* swallow */ }
      }
    }
    for (const h of conn.anyListeners) {
      try { h(payload, eventName); } catch (e) { /* swallow */ }
    }
  });

  conns.set(key, conn);
  return conn;
}

function releaseConn(key: string) {
  const conn = conns.get(key);
  if (!conn) return;
  conn.refCount = Math.max(0, conn.refCount - 1);
  if (conn.refCount === 0) {
    // Defer disconnect — covers route changes and re-mounts.
    conn.cleanupTimer = setTimeout(() => {
      conn.socket.removeAllListeners();
      conn.socket.disconnect();
      conns.delete(key);
    }, 5000);
  }
}

export interface UseThreeCPlusSocketResult extends ThreeCPlusSocketState {
  /** Subscribe to a specific event. Returns an unsubscribe function. */
  subscribe: (eventName: string, handler: Listener) => () => void;
  /** Subscribe to many events at once. Returns a unified unsubscribe. */
  subscribeMany: (map: Record<string, Listener>) => () => void;
  /** Subscribe to ALL events (for logging/audit). */
  subscribeAny: (handler: Listener) => () => void;
  /** Force a reconnect. */
  forceReconnect: () => void;
  /** True when credentials are missing — hook is inert. */
  isInert: boolean;
}

export function useThreeCPlusSocket(): UseThreeCPlusSocketResult {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";
  const tenantId = tenant?.id;

  const isInert = !tenantId || !domain || !apiToken;
  const key = isInert ? "" : `${tenantId}::${cleanDomainOf(domain)}`;

  const [state, setState] = useState<ThreeCPlusSocketState>(() => ({
    status: isInert ? "idle" : "connecting",
    lastEventAt: null,
    lastEventName: null,
    errorMessage: null,
  }));
  const connRef = useRef<SharedConn | null>(null);

  useEffect(() => {
    if (isInert) {
      setState({ status: "idle", lastEventAt: null, lastEventName: null, errorMessage: null });
      return;
    }
    const conn = getOrCreateConn(key, domain, apiToken);
    conn.refCount += 1;
    connRef.current = conn;

    const sub = (s: ThreeCPlusSocketState) => setState(s);
    conn.subscribers.add(sub);
    setState({ ...conn.state });

    return () => {
      conn.subscribers.delete(sub);
      connRef.current = null;
      releaseConn(key);
    };
  }, [key, domain, apiToken, isInert]);

  const subscribe = useCallback((eventName: string, handler: Listener) => {
    const conn = connRef.current;
    if (!conn) return () => {};
    let set = conn.listeners.get(eventName);
    if (!set) {
      set = new Set();
      conn.listeners.set(eventName, set);
    }
    set.add(handler);
    return () => {
      const s = conn.listeners.get(eventName);
      if (s) {
        s.delete(handler);
        if (s.size === 0) conn.listeners.delete(eventName);
      }
    };
  }, []);

  const subscribeMany = useCallback((map: Record<string, Listener>) => {
    const offs: Array<() => void> = [];
    for (const [name, handler] of Object.entries(map)) {
      offs.push(subscribe(name, handler));
    }
    return () => { for (const off of offs) off(); };
  }, [subscribe]);

  const subscribeAny = useCallback((handler: Listener) => {
    const conn = connRef.current;
    if (!conn) return () => {};
    conn.anyListeners.add(handler);
    return () => { conn.anyListeners.delete(handler); };
  }, []);

  const forceReconnect = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    try {
      conn.socket.disconnect();
      conn.socket.connect();
    } catch { /* noop */ }
  }, []);

  return {
    ...state,
    subscribe,
    subscribeMany,
    subscribeAny,
    forceReconnect,
    isInert,
  };
}

/**
 * Canonical event name catalog (kept centralized so we can remap if 3CPLUS
 * exposes pt-BR or camelCase names in production without touching consumers).
 */
export const THREECPLUS_EVENTS = {
  agent: {
    isIdle: "agent-is-idle",
    inAcw: "agent-in-acw",
    loginFailed: "agent-login-failed",
    loggedOut: "agent-logged-out",
    enteredManualCall: "agent-entered-manual-call",
    manualCallEnterFailed: "agent-manual-call-enter-failed",
    leftManualCall: "agent-left-manual-call",
    manualCallExitFailed: "agent-manual-call-exit-failed",
    enteredWorkBreak: "agent-entered-work-break",
    workBreakEnterFailed: "agent-work-break-enter-failed",
    leftWorkBreak: "agent-left-work-break",
    workBreakExitFailed: "agent-work-break-exit-failed",
    scheduleNotification: "schedule-notification",
  },
  call: {
    created: "call-was-created",
    answered: "call-was-answered",
    connected: "call-was-connected",
    hungUp: "call-was-hung-up",
    finished: "call-was-finished",
    abandoned: "call-was-abandoned",
    abandonedByAmd: "call-was-abandoned-by-amd",
    notAnswered: "call-was-not-answered",
    failed: "call-failed",
    historyCreated: "call-history-was-created",
  },
  manualCall: {
    created: "manual-call-was-created",
    connected: "manual-call-was-connected",
    answered: "manual-call-was-answered",
    hungUp: "manual-call-was-hung-up",
    finished: "manual-call-was-finished",
    notAnswered: "manual-call-was-not-answered",
    failed: "manual-call-failed",
    historyCreated: "manual-call-history-was-created",
  },
  receptive: {
    enteredQueue: "receptive-entered-queue",
    connectedToAgent: "receptive-connected-to-agent",
    abandoned: "receptive-abandoned",
    finished: "receptive-finished",
  },
  spy: {
    started: "spy-snoop-started",
    finished: "spy-snoop-finished",
    failed: "spy-snoop-failed",
  },
  mailing: {
    empty: "mailing-list-empty",
  },
} as const;

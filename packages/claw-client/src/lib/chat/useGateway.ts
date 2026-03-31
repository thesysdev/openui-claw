"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GatewaySocket } from "@/lib/gateway/socket";
import { ConnectionState } from "@/lib/gateway/types";
import type { AgentEvent, ChatEvent, ChatHistoryMessage, EventFrame, HelloOk } from "@/lib/gateway/types";
import {
  clearAuthCredentials,
  clearDeviceToken,
  getSettings,
  saveDeviceToken,
} from "@/lib/storage";
import type { Settings } from "@/lib/storage";
import { getOrCreateDeviceIdentity } from "@/lib/gateway/device-identity";
import { EventType } from "@openuidev/react-headless";
import { createOpenClawAGUIMapper } from "./openclaw-agui-mapper";
import { mergeHistoryMessages } from "./history-merger";
import { normalizeSessionPatch } from "@/lib/models";
import type {
  AgentsListResult,
  ClawThreadListItem,
  ModelChoice,
  ModelsListResult,
  SessionGetResult,
  SessionRow,
  SessionsListResult,
} from "@/types/gateway-responses";

export type { ClawThreadListItem } from "@/types/gateway-responses";
export type { SessionRow, ModelChoice } from "@/types/gateway-responses";

const log = (...args: unknown[]) => console.log("[claw:gateway]", ...args);
const warn = (...args: unknown[]) => console.warn("[claw:gateway]", ...args);

interface RunListener {
  onAgentEvent: (event: AgentEvent) => void;
  onChatEvent: (event: ChatEvent) => void;
  onClose: () => void;
}

function createSocket(
  opts: ConstructorParameters<typeof GatewaySocket>[0]
): GatewaySocket {
  return new GatewaySocket(opts);
}

// All Claw sessions end with this suffix so the server-side plugin can detect them.
const CLAW_SUFFIX = ":openui-claw";

function agentMainSessionKey(agentId: string): string {
  return `agent:${agentId}:main${CLAW_SUFFIX}`;
}

export function resolveChatSessionKey(threadId: string, agentIds: Set<string>): string {
  if (agentIds.has(threadId)) return agentMainSessionKey(threadId);
  return threadId;
}

export function useGateway({ onAuthFailed }: { onAuthFailed: () => void }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [settings, setSettings] = useState<Settings | null>(
    () => getSettings()
  );

  const onAuthFailedRef = useRef(onAuthFailed);
  useEffect(() => {
    onAuthFailedRef.current = onAuthFailed;
  }, [onAuthFailed]);

  const runListenerRef = useRef<RunListener | null>(null);

  const handleEvent = useCallback((frame: EventFrame) => {
    if (!runListenerRef.current) return;
    const payload = frame.payload as Record<string, unknown> | undefined;
    if (!payload) return;
    if (frame.event === "agent") {
      runListenerRef.current.onAgentEvent(payload as unknown as AgentEvent);
    } else if (frame.event === "chat") {
      runListenerRef.current.onChatEvent(payload as unknown as ChatEvent);
    }
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const modelsResult =
        await socketRef.current?.request<ModelsListResult>("models.list");
      setAvailableModels(modelsResult?.models ?? []);
      log(`models.list → ${modelsResult?.models?.length ?? 0} model(s)`);
    } catch (e) {
      warn("models.list failed:", e);
    }
  }, []);

  const handleHelloOk = useCallback((hello: HelloOk) => {
    if (hello.auth?.deviceToken) {
      log("saving new deviceToken from hello-ok");
      saveDeviceToken(hello.auth.deviceToken);
      setSettings((prev) =>
        prev ? { ...prev, deviceToken: hello.auth!.deviceToken } : prev
      );
    }
    log("connected ✓");
    setPairingDeviceId(null);
    setConnectionState(ConnectionState.CONNECTED);
    void refreshModels();
  }, [refreshModels]);

  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);

  const socketRef = useRef<GatewaySocket | null>(null);
  const knownAgentIdsRef = useRef<Set<string>>(new Set());

  const [sessionMeta, setSessionMeta] = useState<Map<string, SessionRow>>(
    () => new Map()
  );
  const [availableModels, setAvailableModels] = useState<ModelChoice[]>([]);

  const buildSocketOpts = useCallback(
    (overrideSettings?: Settings | null) => ({
      getSettings: () => overrideSettings ?? getSettings(),
      getDevice: getOrCreateDeviceIdentity,
      onHelloOk: handleHelloOk,
      onAuthFailed: () => {
        const current = getSettings();
        if (current?.deviceToken && current?.token) {
          warn("deviceToken rejected — clearing and retrying with raw token");
          clearDeviceToken();
          setSettings((prev) => {
            if (!prev) return prev;
            const { deviceToken: _dt, ...rest } = prev;
            return rest as Settings;
          });
        } else {
          warn("all auth credentials failed — prompting user");
          clearAuthCredentials();
          setConnectionState(ConnectionState.AUTH_FAILED);
          onAuthFailedRef.current();
        }
      },
      onPairingRequired: (deviceId: string) => {
        log(`pairing required — device ${deviceId}`);
        setPairingDeviceId(deviceId);
        setConnectionState(ConnectionState.PAIRING);
      },
      onEvent: handleEvent,
      onStateChange: (connecting: boolean) => {
        log(`state → ${connecting ? "CONNECTING" : "DISCONNECTED"}`);
        setConnectionState(
          connecting
            ? ConnectionState.CONNECTING
            : ConnectionState.DISCONNECTED,
        );
      },
    }),
    [handleEvent, handleHelloOk],
  );

  useEffect(() => {
    const socket = createSocket(buildSocketOpts());
    socketRef.current = socket;
    if (getSettings()?.gatewayUrl) socket.start();
    return () => socket.stop();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconnect = useCallback(
    (newSettings: Settings) => {
      setSettings(newSettings);
      socketRef.current?.stop();
      const socket = createSocket(buildSocketOpts(newSettings));
      socketRef.current = socket;
      socket.start();
    },
    [buildSocketOpts]
  );

  // ── Session metadata helpers ─────────────────────────────────────────────

  const refreshSessionMeta = useCallback((sessionKey: string) => {
    socketRef.current
      ?.request<SessionGetResult>("sessions.get", { key: sessionKey })
      .then((result) => {
        if (!result?.session) return;
        setSessionMeta((prev) => new Map(prev).set(sessionKey, result.session));
      })
      .catch((e) => warn("sessions.get failed:", e));
  }, []);

  const patchSession = useCallback(
    async (sessionKey: string, patch: Record<string, unknown>): Promise<boolean> => {
      log("patchSession", sessionKey, patch);
      try {
        await socketRef.current?.request("sessions.patch", { key: sessionKey, ...patch });
        const localPatch = normalizeSessionPatch(patch);
        setSessionMeta((prev) => {
          const next = new Map(prev);
          const existing = next.get(sessionKey);
          next.set(sessionKey, { ...existing, key: sessionKey, ...localPatch } as SessionRow);
          return next;
        });
        return true;
      } catch (e) {
        warn("sessions.patch failed:", e);
        return false;
      }
    },
    []
  );

  // ── processMessage bridge ────────────────────────────────────────────────
  const processMessage = useCallback(
    async (params: {
      messages: unknown[];
      abortController: AbortController;
      threadId?: string;
    }): Promise<Response> => {
      const { messages, abortController, threadId } = params;

      const lastMsg = messages[messages.length - 1] as {
        role?: string;
        content?: unknown;
      };
      const raw = lastMsg?.content;
      const messageText =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
          ? raw
              .filter(
                (c: unknown) => (c as { type?: string } | null)?.type === "text"
              )
              .map((c: unknown) => (c as { text?: string } | null)?.text ?? "")
              .join("")
          : "";

      if (!threadId) {
        return new Response(
          JSON.stringify({ type: EventType.RUN_ERROR, message: "No agent selected. Choose an agent from the sidebar." }) + "\n",
          { status: 200, headers: { "Content-Type": "application/octet-stream" } }
        );
      }

      const sessionKey = resolveChatSessionKey(threadId, knownAgentIdsRef.current);
      log(`processMessage  threadId=${threadId}  sessionKey=${sessionKey}`);

      const encoder = new TextEncoder();
      let ctrl!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({ start(c) { ctrl = c; } });

      const write = (event: Record<string, unknown>) => {
        try { ctrl.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { /* closed */ }
      };
      const closeStream = () => {
        runListenerRef.current = null;
        try { ctrl.close(); } catch { /* already closed */ }
      };

      const mapper = createOpenClawAGUIMapper(write);
      runListenerRef.current = {
        onAgentEvent: mapper.onAgentEvent,
        onChatEvent(evt: ChatEvent) {
          mapper.onChatEvent(evt);
          if (evt.state === "final") {
            refreshSessionMeta(sessionKey);
          }
          if (evt.state === "final" || evt.state === "aborted" || evt.state === "error") {
            closeStream();
          }
        },
        onClose: closeStream,
      };

      abortController.signal.addEventListener("abort", () => {
        socketRef.current
          ?.request("chat.abort", { sessionKey })
          .catch(() => {});
        closeStream();
      });

      try {
        await socketRef.current?.request("chat.send", {
          sessionKey,
          message: messageText,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        runListenerRef.current = null;
        write({
          type: EventType.RUN_ERROR,
          message: err instanceof Error ? err.message : "Failed to send",
        });
        closeStream();
      }

      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    },
    [refreshSessionMeta]
  );

  // ── Thread list ──────────────────────────────────────────────────────────
  const fetchThreadList = useCallback(async (): Promise<ClawThreadListItem[]> => {
    log("fetchThreadList");
    let agents: AgentsListResult["agents"] = [];
    try {
      const result = await socketRef.current?.request<AgentsListResult>("agents.list");
      agents = result?.agents ?? [];
      log(`agents.list → ${agents.length} agent(s)`);
    } catch (e) {
      warn("agents.list failed:", e);
    }

    if (!agents.length) {
      knownAgentIdsRef.current = new Set(["main"]);
      return [{ id: "main", title: "Agent", createdAt: Date.now(), clawKind: "main", clawAgentId: "main" }];
    }

    knownAgentIdsRef.current = new Set(agents.map((a) => a.id));
    const items: ClawThreadListItem[] = [];
    const metaUpdates = new Map<string, SessionRow>();

    for (const a of agents) {
      const mainKey = agentMainSessionKey(a.id);
      items.push({
        id: a.id,
        title: [a.identity?.emoji, a.identity?.name].filter(Boolean).join(" ") || a.id,
        createdAt: Date.now(),
        clawKind: "main",
        clawAgentId: a.id,
      });

      try {
        const result = await socketRef.current?.request<SessionsListResult>(
          "sessions.list", { agentId: a.id, limit: 50 },
        );
        const seen = new Set<string>();
        for (const row of result?.sessions ?? []) {
          metaUpdates.set(row.key, row);
          if (!row.key.endsWith(CLAW_SUFFIX) || row.key === mainKey || seen.has(row.key)) continue;
          seen.add(row.key);
          items.push({
            id: row.key,
            title: row.label || row.displayName || row.derivedTitle || row.key,
            createdAt: row.updatedAt ?? Date.now(),
            clawKind: "extra",
            clawAgentId: a.id,
          });
        }
      } catch (e) {
        warn(`sessions.list failed for ${a.id}:`, e);
      }
    }

    if (metaUpdates.size > 0) {
      setSessionMeta((prev) => {
        const next = new Map(prev);
        for (const [k, v] of metaUpdates) next.set(k, v);
        return next;
      });
    }

    return items;
  }, []);

  const createSession = useCallback(async (agentId: string): Promise<string | null> => {
    const key = `agent:${agentId}:${crypto.randomUUID()}${CLAW_SUFFIX}`;
    log("createSession", agentId, key);
    try {
      await socketRef.current?.request("sessions.create", { agentId, key });
      return key;
    } catch (e) {
      warn("sessions.create failed:", e);
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (threadId: string): Promise<boolean> => {
    const sessionKey = resolveChatSessionKey(threadId, knownAgentIdsRef.current);
    log("deleteSession", threadId, sessionKey);
    try {
      await socketRef.current?.request("sessions.delete", {
        key: sessionKey,
        deleteTranscript: true,
      });
      return true;
    } catch (e) {
      warn("sessions.delete failed:", e);
      return false;
    }
  }, []);

  const renameSession = useCallback(async (threadId: string, label: string): Promise<boolean> => {
    const sessionKey = resolveChatSessionKey(threadId, knownAgentIdsRef.current);
    log("renameSession", threadId, sessionKey, label);
    try {
      await socketRef.current?.request("sessions.patch", {
        key: sessionKey,
        label,
      });
      return true;
    } catch (e) {
      warn("sessions.patch (rename) failed:", e);
      return false;
    }
  }, []);

  // ── Load thread = load agent's chat history ────────────────────────────────
  const loadThread = useCallback(async (threadId: string): Promise<
    (
      | { id: string; role: "user" | "assistant"; content: string | null; toolCalls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
      | { id: string; role: "reasoning"; content: string }
      | { id: string; role: "activity"; activityType: string; content: Record<string, unknown> }
    )[]
  > => {
    const sessionKey = resolveChatSessionKey(threadId, knownAgentIdsRef.current);
    log(`loadThread  threadId=${threadId}  sessionKey=${sessionKey}`);
    try {
      const result = await socketRef.current?.request<{
        messages?: ChatHistoryMessage[];
      }>("chat.history", { sessionKey, limit: 100 });
      const raw = result?.messages ?? [];
      log(`chat.history returned ${raw.length} messages`);
      return mergeHistoryMessages(raw);
    } catch (e) {
      warn("chat.history failed:", e);
      return [];
    }
  }, []);

  return {
    connectionState,
    pairingDeviceId,
    settings,
    processMessage,
    fetchThreadList,
    loadThread,
    createSession,
    deleteSession,
    renameSession,
    reconnect,
    sessionMeta,
    availableModels,
    patchSession,
    knownAgentIds: knownAgentIdsRef,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GatewaySocket } from "@/lib/gateway/socket";
import { ConnectionState } from "@/lib/gateway/types";
import type { AgentEvent, ChatEvent, EventFrame, HelloOk } from "@/lib/gateway/types";
import {
  clearAuthCredentials,
  clearDeviceToken,
  getSettings,
  saveDeviceToken,
} from "@/lib/storage";
import type { Settings } from "@/lib/storage";
import { getOrCreateDeviceIdentity } from "@/lib/gateway/device-identity";
import { AGUIEventType } from "./openClawAdapter";

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

// Appends ":openui-claw" suffix for plugin detection. client.id must be a gateway-registered
// constant ("webchat"), so the plugin detects Claw sessions via this session key suffix instead.
function clawSessionKey(key: string): string {
  return `${key}:openui-claw`;
}

// Derives the operator's direct session key for an agent: agent:<id>:main
function agentMainSessionKey(agentId: string): string {
  return `agent:${agentId}:main`;
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

  const handleHelloOk = useCallback((hello: HelloOk) => {
    if (hello.auth?.deviceToken) {
      log("saving new deviceToken from hello-ok");
      saveDeviceToken(hello.auth.deviceToken);
      setSettings((prev) =>
        prev ? { ...prev, deviceToken: hello.auth!.deviceToken } : prev
      );
    }
    log("connected ✓");
    setConnectionState(ConnectionState.CONNECTED);
  }, []);

  const socketRef = useRef<GatewaySocket | null>(null);

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
      onEvent: handleEvent,
      onStateChange: (connecting: boolean) => {
        log(`state → ${connecting ? "CONNECTING" : "DISCONNECTED"}`);
        setConnectionState(
          connecting ? ConnectionState.CONNECTING : ConnectionState.DISCONNECTED
        );
      },
    }),
    [handleEvent, handleHelloOk]
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
          JSON.stringify({
            type: AGUIEventType.RUN_ERROR,
            message: "No agent selected. Choose an agent from the sidebar.",
          }) + "\n",
          { status: 200, headers: { "Content-Type": "application/octet-stream" } }
        );
      }

      const sessionKey = clawSessionKey(agentMainSessionKey(threadId));
      log(`processMessage  threadId=${threadId}  sessionKey=${sessionKey}`);

      const encoder = new TextEncoder();
      let ctrl!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c;
        },
      });

      const write = (event: object) => {
        try {
          ctrl.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // controller already closed
        }
      };

      const closeStream = () => {
        runListenerRef.current = null;
        try {
          ctrl.close();
        } catch {
          // already closed
        }
      };

      let messageId: string | null = null;
      const ensureStarted = (runId: string) => {
        if (!messageId) {
          messageId = runId;
          write({
            type: AGUIEventType.TEXT_MESSAGE_START,
            messageId,
            role: "assistant",
          });
        }
      };

      runListenerRef.current = {
        onAgentEvent(evt: AgentEvent) {
          ensureStarted(evt.runId);
          const delta = evt.data?.delta;
          if (delta) {
            write({
              type: AGUIEventType.TEXT_MESSAGE_CONTENT,
              messageId,
              delta,
            });
          }
        },
        onChatEvent(evt: ChatEvent) {
          if (evt.state === "delta") {
            ensureStarted(evt.runId);
            const text =
              typeof evt.message === "string" ? evt.message : null;
            if (text) {
              write({
                type: AGUIEventType.TEXT_MESSAGE_CONTENT,
                messageId,
                delta: text,
              });
            }
          } else if (evt.state === "final" || evt.state === "aborted") {
            if (messageId) write({ type: AGUIEventType.TEXT_MESSAGE_END, messageId });
            write({ type: AGUIEventType.RUN_FINISHED });
            closeStream();
          } else if (evt.state === "error") {
            write({
              type: AGUIEventType.RUN_ERROR,
              message: evt.errorMessage ?? "Agent error",
            });
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
          type: AGUIEventType.RUN_ERROR,
          message: err instanceof Error ? err.message : "Failed to send",
        });
        closeStream();
      }

      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    },
    []
  );

  // ── Thread list = agent list ───────────────────────────────────────────────
  const fetchThreadList = useCallback(async (): Promise<
    { id: string; title?: string }[]
  > => {
    log("fetchThreadList — calling agents.list");
    try {
      const result = await socketRef.current?.request<{
        agents?: Array<{ id: string; name?: string; emoji?: string }>;
      }>("agents.list");
      const agents = result?.agents ?? [];
      log(`agents.list returned ${agents.length} agent(s):`, agents.map((a) => a.id));
      if (agents.length > 0) {
        return agents.map((a) => ({
          id: a.id,
          title: [a.emoji, a.name].filter(Boolean).join(" ") || a.id,
        }));
      }
    } catch (e) {
      warn("agents.list failed — using fallback:", e);
    }
    return [{ id: "main", title: "Agent" }];
  }, []);

  // ── Load thread = load agent's chat history ────────────────────────────────
  const loadThread = useCallback(async (agentId: string): Promise<
    { id: string; role: "user" | "assistant"; content: string | null }[]
  > => {
    const sessionKey = clawSessionKey(agentMainSessionKey(agentId));
    log(`loadThread  agentId=${agentId}  sessionKey=${sessionKey}`);
    try {
      const result = await socketRef.current?.request<{
        messages?: Array<{ id?: string; role?: string; content?: unknown }>;
      }>("chat.history", { sessionKey, limit: 100 });
      const raw = result?.messages ?? [];
      const filtered = raw.filter((m) => m.role === "user" || m.role === "assistant");
      log(`chat.history returned ${raw.length} messages (${filtered.length} user/assistant)`);
      return filtered.map((m) => ({
        id: m.id ?? crypto.randomUUID(),
        role: (m.role ?? "assistant") as "user" | "assistant",
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
            ? (m.content as unknown[])
                .filter((c) => (c as { type?: string } | null)?.type === "text")
                .map((c) => (c as { text?: string } | null)?.text ?? "")
                .join("")
            : null,
      }));
    } catch (e) {
      warn("chat.history failed:", e);
      return [];
    }
  }, []);

  return {
    connectionState,
    settings,
    processMessage,
    fetchThreadList,
    loadThread,
    reconnect,
  };
}

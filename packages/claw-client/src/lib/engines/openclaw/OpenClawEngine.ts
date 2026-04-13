import { GatewaySocket } from "@/lib/gateway/socket";
import { ConnectionState } from "@/lib/gateway/types";
import type {
  AgentEvent,
  ChatEvent,
  ChatHistoryMessage,
  EventFrame,
  HelloOk,
} from "@/lib/gateway/types";
import {
  clearAuthCredentials,
  clearDeviceToken,
  getSettings,
  saveDeviceToken,
} from "@/lib/storage";
import type { Settings } from "@/lib/storage";
import { getOrCreateDeviceIdentity } from "@/lib/gateway/device-identity";
import { EventType } from "@openuidev/react-headless";
import { createOpenClawAGUIMapper } from "@/lib/chat/openclaw-agui-mapper";
import { mergeHistoryMessages } from "@/lib/chat/history-merger";
import type { MergedMessage } from "@/lib/chat/history-merger";
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
import type {
  AgentInfo,
  AppRecord,
  AppStore,
  AppSummary,
  ArtifactRecord,
  ArtifactStore,
  ArtifactSummary,
  ConversationStore,
  Engine,
  EngineCapabilities,
  ModelInfo,
  OpenClawEngineConfig,
  SessionInfo,
  StoredMessage,
} from "../types";

const log = (...args: unknown[]) =>
  console.log("[claw:openclaw-engine]", ...args);
const warn = (...args: unknown[]) =>
  console.warn("[claw:openclaw-engine]", ...args);

const CLAW_SUFFIX = ":openui-claw";

export function agentMainSessionKey(agentId: string): string {
  return `agent:${agentId}:main${CLAW_SUFFIX}`;
}

export function resolveChatSessionKey(
  threadId: string,
  agentIds: Set<string>
): string {
  if (agentIds.has(threadId)) return agentMainSessionKey(threadId);
  return threadId;
}

/** Convert MergedMessage[] → StoredMessage[], folding reasoning into assistant. */
function mergedToStored(merged: MergedMessage[]): StoredMessage[] {
  const result: StoredMessage[] = [];
  let pendingReasoning: string | null = null;

  for (const m of merged) {
    if (m.role === "reasoning") {
      pendingReasoning = m.content;
      continue;
    }
    if (m.role === "user") {
      pendingReasoning = null;
      result.push({ id: m.id, role: "user", content: m.content ?? "" });
      continue;
    }
    if (m.role === "assistant") {
      result.push({
        id: m.id,
        role: "assistant",
        content: m.content,
        ...(pendingReasoning ? { reasoning: pendingReasoning } : {}),
        ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
      });
      pendingReasoning = null;
      continue;
    }
    if (m.role === "activity") {
      result.push(m);
      pendingReasoning = null;
    }
  }

  return result;
}

interface RunListener {
  onAgentEvent: (event: AgentEvent) => void;
  onChatEvent: (event: ChatEvent) => void;
  onClose: () => void;
}

export interface OpenClawEngineEvents {
  onConnectionStateChange: (state: ConnectionState) => void;
  onPairingRequired: (deviceId: string | null) => void;
  onAuthFailed: () => void;
  onSettingsChanged: (settings: Settings) => void;
  onSessionMetaChanged: (meta: Map<string, SessionRow>) => void;
  onModelsChanged: (models: ModelChoice[]) => void;
  onKnownAgentIdsChanged: (ids: Set<string>) => void;
}

export class OpenClawEngine implements Engine {
  readonly id: string;

  readonly capabilities: EngineCapabilities = {
    loadSession: true,
    listSessions: true,
    deleteSessions: true,
    multiAgent: true,
    sessionConfig: true,
    artifacts: true,
    apps: true,
  };

  private socket: GatewaySocket | null = null;
  private runListener: RunListener | null = null;
  private knownAgentIds = new Set<string>();

  private _connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private _settings: Settings | null;
  private _sessionMeta = new Map<string, SessionRow>();
  private _availableModels: ModelChoice[] = [];
  private events: OpenClawEngineEvents;

  private _isReady = false;
  private _readyDeferred: {
    promise: Promise<void>;
    resolve: () => void;
    reject: (e: Error) => void;
  } | null = null;

  /** Resolves immediately if hello-ok already fired, otherwise waits. */
  private get _engineReady(): Promise<void> {
    if (this._isReady) return Promise.resolve();
    if (!this._readyDeferred) {
      let resolve!: () => void, reject!: (e: Error) => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      this._readyDeferred = { promise, resolve, reject };
    }
    return this._readyDeferred.promise;
  }

  constructor(
    config: OpenClawEngineConfig,
    events: OpenClawEngineEvents
  ) {
    this.id = config.id;
    this._settings = config.gatewayUrl
      ? { gatewayUrl: config.gatewayUrl, token: config.token, deviceToken: config.deviceToken }
      : getSettings();
    this.events = events;
  }

  // ── Engine interface: stores ───────────────────────────────────────────────

  readonly conversations: ConversationStore = {
    listSessions: (agentId) => this._listSessions(agentId),
    getSession: (sessionId) => this._getSession(sessionId),
    createSession: (agentId, title) => this._createSessionRecord(agentId, title),
    deleteSession: (sessionId) => this._deleteSessionRecord(sessionId),
    renameSession: (sessionId, title) => this._renameSessionRecord(sessionId, title),
    loadHistory: (sessionId) => this._loadHistory(sessionId),
    appendMessage: async () => { /* server persists messages via chat.send — no-op */ },
    getSessionConfig: (sessionId) => this._getSessionConfig(sessionId),
    setSessionConfig: (sessionId, key, value) =>
      this._setSessionConfig(sessionId, key, value),
  };

  readonly artifacts: ArtifactStore = {
    listArtifacts: async (kind?: string): Promise<ArtifactSummary[]> => {
      try {
        const result = await this._request<{ artifacts: ArtifactSummary[] }>(
          "artifacts.list",
          { kind },
        );
        return result?.artifacts ?? [];
      } catch {
        return [];
      }
    },

    getArtifact: async (artifactId: string): Promise<ArtifactRecord | null> => {
      try {
        const result = await this._request<{ artifact: ArtifactRecord | null }>(
          "artifacts.get",
          { id: artifactId },
        );
        return result?.artifact ?? null;
      } catch {
        return null;
      }
    },

    deleteArtifact: async (artifactId: string): Promise<void> => {
      await this._request("artifacts.delete", { id: artifactId });
    },
  };

  readonly apps: AppStore = {
    listApps: async (): Promise<AppSummary[]> => {
      try {
        const result = await this._request<{ apps: AppSummary[] }>("apps.list", {});
        return result?.apps ?? [];
      } catch {
        return [];
      }
    },

    getApp: async (appId: string): Promise<AppRecord | null> => {
      try {
        const result = await this._request<{ app: AppRecord | null }>("apps.get", { id: appId });
        return result?.app ?? null;
      } catch {
        return null;
      }
    },

    deleteApp: async (appId: string): Promise<void> => {
      await this._request("apps.delete", { id: appId });
    },

    invokeTool: async (tool: string, args: Record<string, unknown>, sessionKey?: string): Promise<unknown> => {
      const result = await this._request<{ result: unknown }>("tools.invoke", {
        tool_name: tool,
        tool_args: args,
        ...(sessionKey ? { sessionKey } : {}),
      });
      return result?.result ?? null;
    },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.socket = this._createSocket(this._settings);
    if (this._settings?.gatewayUrl) this.socket.start();
  }

  async disconnect(): Promise<void> {
    this._isReady = false;
    this._readyDeferred?.reject(new Error("disconnected"));
    this._readyDeferred = null;
    this.socket?.stop();
    this.socket = null;
  }

  reconnect(newSettings: Settings): void {
    this._isReady = false;
    this._readyDeferred?.reject(new Error("reconnecting"));
    this._readyDeferred = null;
    this._settings = newSettings;
    this.events.onSettingsChanged(newSettings);
    this.socket?.stop();
    this.socket = this._createSocket(newSettings);
    this.socket.start();
  }

  // ── Engine interface: orchestration ──────────────────────────────────────

  async listAgents(): Promise<AgentInfo[]> {
    try {
      const result = await this._request<AgentsListResult>("agents.list");
      return (result?.agents ?? []).map((a) => ({
        id: a.id,
        name: a.identity?.name ?? a.id,
      }));
    } catch (e) {
      warn("agents.list failed:", e);
      return [];
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this._availableModels.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      provider: m.provider ?? "unknown",
      contextWindow: m.contextWindow,
      capabilities: m.reasoning ? { thinking: m.reasoning } : undefined,
    }));
  }

  async sendMessage(
    sessionId: string,
    messages: unknown[],
    abortController: AbortController
  ): Promise<Response> {
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
            .filter((c: unknown) => (c as { type?: string } | null)?.type === "text")
            .map((c: unknown) => (c as { text?: string } | null)?.text ?? "")
            .join("")
        : "";

    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    log(`sendMessage  sessionId=${sessionId}  sessionKey=${sessionKey}`);

    const encoder = new TextEncoder();
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) { ctrl = c; },
    });

    const write = (event: Record<string, unknown>) => {
      try { ctrl.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { /* closed */ }
    };
    const closeStream = () => {
      this.runListener = null;
      try { ctrl.close(); } catch { /* already closed */ }
    };

    const mapper = createOpenClawAGUIMapper(write);
    this.runListener = {
      onAgentEvent: mapper.onAgentEvent,
      onChatEvent: (evt: ChatEvent) => {
        mapper.onChatEvent(evt);
        if (evt.state === "final") {
          this._refreshSessionMeta(sessionKey);
        }
        if (evt.state === "final" || evt.state === "aborted" || evt.state === "error") {
          closeStream();
        }
      },
      onClose: closeStream,
    };

    abortController.signal.addEventListener("abort", () => {
      this.socket?.request("chat.abort", { sessionKey }).catch(() => {});
      closeStream();
    });

    try {
      await this.socket?.request("chat.send", {
        sessionKey,
        message: messageText,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      this.runListener = null;
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
  }

  async abort(sessionId: string): Promise<void> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    await this.socket?.request("chat.abort", { sessionKey }).catch(() => {});
  }

  // ── Store-forwarding convenience methods ──────────────────────────────────

  async createSession(agentId: string, title?: string): Promise<SessionInfo> {
    return this.conversations.createSession(agentId, title);
  }

  async loadHistory(sessionId: string): Promise<StoredMessage[]> {
    return this.conversations.loadHistory(sessionId);
  }

  async listSessions(agentId?: string): Promise<SessionInfo[]> {
    return this.conversations.listSessions(agentId);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await this.conversations.deleteSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  async getSessionConfig(sessionId: string): Promise<Record<string, string>> {
    return this.conversations.getSessionConfig(sessionId);
  }

  async setSessionConfig(
    sessionId: string,
    key: string,
    value: string
  ): Promise<void> {
    return this.conversations.setSessionConfig(sessionId, key, value);
  }

  // ── Legacy methods (kept for useGateway backward compat, removed with useEngines) ──

  async fetchThreadList(): Promise<ClawThreadListItem[]> {
    let agents: NonNullable<AgentsListResult["agents"]> = [];
    try {
      const result = await this._request<AgentsListResult>("agents.list");
      agents = result?.agents ?? [];
      log(`agents.list → ${agents.length} agent(s)`);
    } catch (e) {
      warn("agents.list failed:", e);
    }

    if (!agents.length) {
      this._setKnownAgentIds(new Set(["main"]));
      return [
        { id: "main", title: "Agent", createdAt: Date.now(), clawKind: "main", clawAgentId: "main" },
      ];
    }

    this._setKnownAgentIds(new Set(agents.map((a) => a.id)));

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
        const result = await this._request<SessionsListResult>(
          "sessions.list",
          { agentId: a.id, limit: 50 }
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
      for (const [k, v] of metaUpdates) this._sessionMeta.set(k, v);
      this.events.onSessionMetaChanged(new Map(this._sessionMeta));
    }

    return items;
  }

  async patchSession(
    sessionKey: string,
    patch: Record<string, unknown>
  ): Promise<boolean> {
    log("patchSession", sessionKey, patch);
    try {
      await this._request("sessions.patch", { key: sessionKey, ...patch });
      const localPatch = normalizeSessionPatch(patch);
      this._sessionMeta.set(sessionKey, {
        ...this._sessionMeta.get(sessionKey),
        key: sessionKey,
        ...localPatch,
      } as SessionRow);
      this.events.onSessionMetaChanged(new Map(this._sessionMeta));
      return true;
    } catch (e) {
      warn("sessions.patch failed:", e);
      return false;
    }
  }

  // ── Public state accessors ────────────────────────────────────────────────

  get connectionState(): ConnectionState { return this._connectionState; }
  get settings(): Settings | null { return this._settings; }
  get sessionMeta(): Map<string, SessionRow> { return this._sessionMeta; }
  get availableModels(): ModelChoice[] { return this._availableModels; }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Awaits engine readiness (socket creation + hello-ok handshake) then
   * delegates to socket.request. Use for all data RPCs so they automatically
   * wait even when called before connect() has run (e.g. from child component
   * effects that fire before the parent's useGateway effect).
   */
  private async _request<T>(method: string, params?: unknown): Promise<T> {
    await this._engineReady;
    return this.socket!.request<T>(method, params);
  }

  private _createSocket(settings: Settings | null): GatewaySocket {
    return new GatewaySocket({
      getSettings: () => settings ?? getSettings(),
      getDevice: getOrCreateDeviceIdentity,
      onHelloOk: this._handleHelloOk,
      onAuthFailed: this._handleAuthFailed,
      onPairingRequired: (deviceId: string) => {
        log(`pairing required — device ${deviceId}`);
        this.events.onPairingRequired(deviceId);
        this._setConnectionState(ConnectionState.PAIRING);
      },
      onEvent: this._handleEvent,
      onStateChange: (connecting: boolean) => {
        log(`state → ${connecting ? "CONNECTING" : "DISCONNECTED"}`);
        this._setConnectionState(
          connecting ? ConnectionState.CONNECTING : ConnectionState.DISCONNECTED
        );
      },
    });
  }

  private _setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    this.events.onConnectionStateChange(state);
  }

  private _setKnownAgentIds(ids: Set<string>): void {
    this.knownAgentIds = ids;
    this.events.onKnownAgentIdsChanged(ids);
  }

  private _handleEvent = (frame: EventFrame): void => {
    if (!this.runListener) return;
    const payload = frame.payload as Record<string, unknown> | undefined;
    if (!payload) return;
    if (frame.event === "agent") {
      this.runListener.onAgentEvent(payload as unknown as AgentEvent);
      if (
        (payload as { stream?: string }).stream === "lifecycle" &&
        ((payload as { data?: { phase?: string } }).data?.phase === "error")
      ) {
        this.runListener.onClose();
      }
    } else if (frame.event === "chat") {
      this.runListener.onChatEvent(payload as unknown as ChatEvent);
    }
  };

  private _handleHelloOk = (hello: HelloOk): void => {
    if (hello.auth?.deviceToken) {
      log("saving new deviceToken from hello-ok");
      saveDeviceToken(hello.auth.deviceToken);
      if (this._settings) {
        const updated = { ...this._settings, deviceToken: hello.auth.deviceToken };
        this._settings = updated;
        this.events.onSettingsChanged(updated);
      }
    }
    log("connected ✓");
    this.events.onPairingRequired(null);
    this._setConnectionState(ConnectionState.CONNECTED);
    this._isReady = true;
    this._readyDeferred?.resolve();
    void this._refreshModels();
  };

  private _handleAuthFailed = (): void => {
    const current = getSettings();
    if (current?.deviceToken && current?.token) {
      warn("deviceToken rejected — clearing and retrying with raw token");
      clearDeviceToken();
      if (this._settings) {
        const { deviceToken: _dt, ...rest } = this._settings as Settings & { deviceToken?: string };
        this._settings = rest as Settings;
        this.events.onSettingsChanged(this._settings);
      }
    } else {
      warn("all auth credentials failed — prompting user");
      clearAuthCredentials();
      this._setConnectionState(ConnectionState.AUTH_FAILED);
      this._isReady = false;
      this._readyDeferred?.reject(new Error("auth failed"));
      this._readyDeferred = null;
      this.events.onAuthFailed();
    }
  };

  private async _refreshModels(): Promise<void> {
    try {
      const result = await this._request<ModelsListResult>("models.list");
      this._availableModels = result?.models ?? [];
      this.events.onModelsChanged(this._availableModels);
      log(`models.list → ${this._availableModels.length} model(s)`);
    } catch (e) {
      warn("models.list failed:", e);
    }
  }

  private _refreshSessionMeta(sessionKey: string): void {
    this._request<SessionGetResult>("sessions.get", { key: sessionKey })
      .then((result) => {
        if (!result?.session) return;
        this._sessionMeta.set(sessionKey, result.session);
        this.events.onSessionMetaChanged(new Map(this._sessionMeta));
      })
      .catch((e) => warn("sessions.get failed:", e));
  }

  // ── ConversationStore implementation ──────────────────────────────────────

  private async _listSessions(agentId?: string): Promise<SessionInfo[]> {
    try {
      const result = await this._request<SessionsListResult>(
        "sessions.list",
        agentId ? { agentId, limit: 100 } : { limit: 100 }
      );
      return (result?.sessions ?? []).map((row) => ({
        id: row.key,
        agentId: agentId ?? "",
        title: row.label || row.displayName || row.derivedTitle || row.key,
        createdAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      }));
    } catch (e) {
      warn("sessions.list failed:", e);
      return [];
    }
  }

  private async _getSession(sessionId: string): Promise<SessionInfo | null> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    try {
      const result = await this._request<SessionGetResult>(
        "sessions.get",
        { key: sessionKey }
      );
      if (!result?.session) return null;
      const row = result.session;
      return {
        id: sessionId,
        agentId: "",
        title: row.label || row.displayName || row.derivedTitle || sessionId,
        createdAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
      };
    } catch (e) {
      warn("sessions.get failed:", e);
      return null;
    }
  }

  private async _createSessionRecord(
    agentId: string,
    _title?: string
  ): Promise<SessionInfo> {
    const key = `agent:${agentId}:${crypto.randomUUID()}${CLAW_SUFFIX}`;
    log("createSession", agentId, key);
    try {
      await this._request("sessions.create", { agentId, key });
    } catch (e) {
      warn("sessions.create failed:", e);
    }
    return { id: key, agentId, createdAt: new Date().toISOString() };
  }

  private async _deleteSessionRecord(sessionId: string): Promise<void> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    await this._request("sessions.delete", {
      key: sessionKey,
      deleteTranscript: true,
    });
  }

  private async _renameSessionRecord(
    sessionId: string,
    title: string
  ): Promise<void> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    await this._request("sessions.patch", { key: sessionKey, label: title });
  }

  private async _loadHistory(sessionId: string): Promise<StoredMessage[]> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    log(`loadHistory  sessionId=${sessionId}  sessionKey=${sessionKey}`);
    try {
      const result = await this._request<{
        messages?: ChatHistoryMessage[];
      }>("chat.history", { sessionKey, limit: 100 });
      const raw = result?.messages ?? [];
      log(`chat.history returned ${raw.length} messages`);
      return mergedToStored(mergeHistoryMessages(raw));
    } catch (e) {
      warn("chat.history failed:", e);
      return [];
    }
  }

  private async _getSessionConfig(
    sessionId: string
  ): Promise<Record<string, string>> {
    const sessionKey = resolveChatSessionKey(sessionId, this.knownAgentIds);
    try {
      const result = await this._request<SessionGetResult>(
        "sessions.get",
        { key: sessionKey }
      );
      if (!result?.session) return {};
      const { model, thinkingLevel } = result.session;
      const config: Record<string, string> = {};
      if (model) config.model = model;
      if (thinkingLevel) config.thinkingLevel = thinkingLevel;
      return config;
    } catch (e) {
      warn("sessions.get (config) failed:", e);
      return {};
    }
  }

  private async _setSessionConfig(
    sessionId: string,
    key: string,
    value: string
  ): Promise<void> {
    await this.patchSession(
      resolveChatSessionKey(sessionId, this.knownAgentIds),
      { [key]: value }
    );
  }
}

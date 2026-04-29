import type { AssistantTimelineSegment } from "@/lib/chat/timeline";

// ── Domain types ──────────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  name?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  capabilities?: {
    thinking?: boolean;
    vision?: boolean;
  };
}

export interface SessionInfo {
  id: string;
  agentId: string;
  title?: string;
  createdAt: string; // ISO 8601
  updatedAt?: string;
}

export interface SessionConfigOption {
  id: string;
  category?: "model" | "thinking" | "mode" | string;
  label: string;
  type: "select";
  currentValue: string;
  options: { id: string; label: string; description?: string }[];
}

/**
 * Native slash command exposed by OpenClaw's `commands.list` RPC.
 * The gateway intercepts these when the user sends `/<name> args` via
 * `chat.send`; the client only uses them for autocomplete + help text.
 */
export interface GatewayCommand {
  key: string;
  name: string;
  description: string;
  argHint?: string;
}

/** Raw shape returned by `commands.list` — kept loose for forward compat. */
export interface GatewayCommandRaw {
  name?: unknown;
  nativeName?: unknown;
  textAliases?: unknown;
  description?: unknown;
  category?: unknown;
  source?: unknown;
  scope?: unknown;
  acceptsArgs?: unknown;
  args?: Array<{ name?: unknown } | unknown> | unknown;
}

export type StopReason = "end_turn" | "cancelled" | "max_tokens" | "error";

// ── Stored message ────────────────────────────────────────────────────────────
// Reasoning/tool chronology can be stored as a lightweight timeline on the
// assistant message so replay matches the live stream.

export type StoredMessage =
  | {
      id: string;
      role: "user";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string | null;
      reasoning?: string;
      timeline?: AssistantTimelineSegment[];
      toolCalls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | {
      id: string;
      role: "activity";
      activityType: string;
      content: Record<string, unknown>;
    };

// ── Source reference ─────────────────────────────────────────────────────────

export interface SourceRef {
  engineId: string;
  agentId: string;
  sessionId: string;
}

// ── Artifact types ────────────────────────────────────────────────────────────

export interface ArtifactRecord {
  id: string;
  kind: string;
  title: string;
  content: unknown;
  metadata?: Record<string, unknown>;
  source: SourceRef;
  createdAt: string;
  updatedAt: string;
}

export type ArtifactSummary = Pick<
  ArtifactRecord,
  "id" | "kind" | "title" | "source" | "createdAt" | "updatedAt"
>;

// ── App types ─────────────────────────────────────────────────────────────────

export interface AppRecord {
  id: string;
  title: string;
  /** OpenUI Lang markup rendered by the Renderer. */
  content: string;
  agentId: string;
  sessionKey: string;
  createdAt: string;
  updatedAt: string;
}

export type AppSummary = Pick<
  AppRecord,
  "id" | "title" | "agentId" | "sessionKey" | "createdAt" | "updatedAt"
>;

// ── Store interfaces ──────────────────────────────────────────────────────────

export interface ConversationStore {
  listSessions(agentId?: string): Promise<SessionInfo[]>;
  getSession(sessionId: string): Promise<SessionInfo | null>;
  createSession(agentId: string, title?: string): Promise<SessionInfo>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;

  loadHistory(sessionId: string): Promise<StoredMessage[]>;

  getSessionConfig(sessionId: string): Promise<Record<string, string>>;
  setSessionConfig(sessionId: string, key: string, value: string): Promise<void>;
}

// UI only reads artifacts; writes happen internally when agent stream events arrive.
export interface ArtifactStore {
  listArtifacts(kind?: string): Promise<ArtifactSummary[]>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
  deleteArtifact(artifactId: string): Promise<void>;
}

export interface AppStore {
  listApps(): Promise<AppSummary[]>;
  getApp(appId: string): Promise<AppRecord | null>;
  deleteApp(appId: string): Promise<void>;
  /** Invoke a tool by name with args via the gateway `tools.invoke` RPC.
   * Pass sessionKey to scope the execution to the app's agent session. */
  invokeTool(tool: string, args: Record<string, unknown>, sessionKey?: string): Promise<unknown>;
}

// ── Upload types ──────────────────────────────────────────────────────────────

export interface UploadMeta {
  id: string;
  sessionKey: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface UploadRecord extends UploadMeta {
  /** Base64-encoded file content. */
  content: string;
}

export interface UploadStore {
  putUpload(params: {
    sessionKey: string;
    name: string;
    mimeType: string;
    content: string;
    size?: number;
  }): Promise<UploadMeta | null>;
  listUploads(sessionKey?: string): Promise<UploadMeta[]>;
  getUpload(id: string): Promise<UploadRecord | null>;
  deleteUpload(id: string): Promise<void>;
}

// ── Skills ─ feature removed ───────────────────────────────────────────────
//
// The Skills browser UI was removed; the SkillStatusEntry / SkillsStore
// types and the gateway's skills.status / skills.update RPCs are no longer
// surfaced through the engine. The original definitions are kept commented
// here for reference if the feature is restored.
//
// export interface SkillStatusEntry { ... }
// export interface SkillsStore { ... }

// ── Engine capabilities ───────────────────────────────────────────────────────

export interface EngineCapabilities {
  loadSession?: boolean;
  listSessions?: boolean;
  deleteSessions?: boolean;
  multiAgent?: boolean;
  sessionConfig?: boolean;
  artifacts?: boolean;
  apps?: boolean;
  uploads?: boolean;
}

// ── Engine interface ──────────────────────────────────────────────────────────

export interface Engine {
  readonly id: string;
  readonly capabilities: EngineCapabilities;
  readonly conversations: ConversationStore;
  readonly artifacts?: ArtifactStore; // present when capabilities.artifacts
  readonly apps?: AppStore; // present when capabilities.apps
  readonly uploads?: UploadStore; // present when capabilities.uploads

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Orchestration
  listAgents(): Promise<AgentInfo[]>;
  listModels(): Promise<ModelInfo[]>;
  sendMessage(
    sessionId: string,
    messages: unknown[],
    abortController: AbortController,
  ): Promise<Response>;
  abort(sessionId: string): Promise<void>;
}

// ── Engine config ─────────────────────────────────────────────────────────────

export interface EngineConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface OpenClawEngineConfig extends EngineConfig {
  gatewayUrl: string;
  token?: string;
  deviceToken?: string;
}

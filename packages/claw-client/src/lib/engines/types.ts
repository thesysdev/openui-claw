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

export type StopReason = "end_turn" | "cancelled" | "max_tokens" | "error";

// ── Stored message ────────────────────────────────────────────────────────────
// Reasoning is stored as a field on the assistant message, not a separate role.

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

// ── Store interfaces ──────────────────────────────────────────────────────────

export interface ConversationStore {
  listSessions(agentId?: string): Promise<SessionInfo[]>;
  getSession(sessionId: string): Promise<SessionInfo | null>;
  createSession(agentId: string, title?: string): Promise<SessionInfo>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;

  loadHistory(sessionId: string): Promise<StoredMessage[]>;
  appendMessage(sessionId: string, message: StoredMessage): Promise<void>;

  getSessionConfig(sessionId: string): Promise<Record<string, string>>;
  setSessionConfig(sessionId: string, key: string, value: string): Promise<void>;
}

// UI only reads artifacts; writes happen internally when agent stream events arrive.
export interface ArtifactStore {
  listArtifacts(kind?: string): Promise<ArtifactSummary[]>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
  deleteArtifact(artifactId: string): Promise<void>;
}

// ── Engine capabilities ───────────────────────────────────────────────────────

export interface EngineCapabilities {
  loadSession?: boolean;
  listSessions?: boolean;
  deleteSessions?: boolean;
  multiAgent?: boolean;
  sessionConfig?: boolean;
  artifacts?: boolean;
}

// ── Engine interface ──────────────────────────────────────────────────────────

export interface Engine {
  readonly id: string;
  readonly capabilities: EngineCapabilities;
  readonly conversations: ConversationStore;
  readonly artifacts?: ArtifactStore; // present when capabilities.artifacts

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Orchestration
  listAgents(): Promise<AgentInfo[]>;
  listModels(): Promise<ModelInfo[]>;
  sendMessage(
    sessionId: string,
    messages: unknown[],
    abortController: AbortController
  ): Promise<Response>;
  abort(sessionId: string): Promise<void>;

  // Store-forwarding convenience methods
  createSession(agentId: string, title?: string): Promise<SessionInfo>;
  loadHistory(sessionId: string): Promise<StoredMessage[]>;
  listSessions?(agentId?: string): Promise<SessionInfo[]>;
  deleteSession?(sessionId: string): Promise<boolean>;
  getSessionConfig?(sessionId: string): Promise<Record<string, string>>;
  setSessionConfig?(sessionId: string, key: string, value: string): Promise<void>;
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

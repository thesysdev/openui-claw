import type { NotificationRecord } from "@/lib/notifications";

// Gateway RPC response types (subset used by the Claw client).
// Source of truth: OpenClaw AgentSummarySchema / sessions.list / agents.list

export interface SessionRow {
  key: string;
  label?: string | null;
  displayName?: string | null;
  derivedTitle?: string | null;
  updatedAt?: number | null;
  thinkingLevel?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  totalTokens?: number | null;
  totalTokensFresh?: boolean | null;
  contextTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface ModelChoice {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

export interface ModelsListResult {
  models: ModelChoice[];
}

export interface SessionsListResult {
  sessions: SessionRow[];
}

export interface SessionGetResult {
  session: SessionRow;
}

export interface AgentIdentity {
  name?: string;
  emoji?: string;
  theme?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface AgentsListResult {
  defaultId?: string;
  agents?: Array<{ id: string; identity?: AgentIdentity }>;
}

export type ClawThreadListItem = {
  id: string;
  title: string;
  createdAt: number;
  clawKind: "main" | "extra";
  clawAgentId: string;
};

export interface NotificationsListResult {
  notifications: NotificationRecord[];
}

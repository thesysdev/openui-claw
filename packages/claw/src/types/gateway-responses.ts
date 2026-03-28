// Gateway RPC response types (subset used by the Claw client).
// Source of truth: OpenClaw AgentSummarySchema / sessions.list / agents.list

export interface SessionRow {
  key: string;
  displayName?: string | null;
  derivedTitle?: string | null;
  updatedAt?: number | null;
}

export interface SessionsListResult {
  sessions: SessionRow[];
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

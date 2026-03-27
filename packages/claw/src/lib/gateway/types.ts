// Protocol frame types matching OpenClaw gateway protocol v3.
// Defined locally to avoid bundling the server-only `openclaw` package.
// Source of truth: https://github.com/openclaw/openclaw/blob/main/src/gateway/protocol/client-info.ts
// Schema definitions: https://github.com/openclaw/openclaw/blob/main/src/gateway/protocol/schema/

// Copied verbatim from src/gateway/protocol/client-info.ts — no subpath export exists for this.
export const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: "webchat-ui",
  CONTROL_UI: "openclaw-control-ui",
  TUI: "openclaw-tui",
  WEBCHAT: "webchat",
  CLI: "cli",
  GATEWAY_CLIENT: "gateway-client",
  MACOS_APP: "openclaw-macos",
  IOS_APP: "openclaw-ios",
  ANDROID_APP: "openclaw-android",
  NODE_HOST: "node-host",
  TEST: "test",
  FINGERPRINT: "fingerprint",
  PROBE: "openclaw-probe",
} as const;

export type GatewayClientId = (typeof GATEWAY_CLIENT_IDS)[keyof typeof GATEWAY_CLIENT_IDS];

export const GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",
  CLI: "cli",
  UI: "ui",
  BACKEND: "backend",
  NODE: "node",
  PROBE: "probe",
  TEST: "test",
} as const;

export type GatewayClientMode = (typeof GATEWAY_CLIENT_MODES)[keyof typeof GATEWAY_CLIENT_MODES];

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface GatewayErrorDetails {
  code?: string;
  reason?: string;
  canRetryWithDeviceToken?: boolean;
  /** retry_with_device_token | update_auth_configuration | update_auth_credentials | wait_then_retry | review_auth_configuration */
  recommendedNextStep?: string;
}

export interface GatewayError {
  message?: string;
  details?: GatewayErrorDetails;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string | GatewayError;
}

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

export interface ConnectChallenge {
  nonce: string;
  ts: number;
}

export interface ConnectParams {
  minProtocol?: number;
  maxProtocol?: number;
  client?: {
    id: GatewayClientId;
    version?: string;
    platform?: string;
    mode?: GatewayClientMode;
    displayName?: string;
    instanceId?: string;
  };
  role?: string;
  scopes?: string[];
  auth?: {
    token?: string;
    deviceToken?: string;
  };
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
  locale?: string;
  userAgent?: string;
}

export interface HelloOk {
  protocol: number;
  auth?: {
    deviceToken?: string;
  };
  features?: Record<string, unknown>;
}

// event:chat payload — run lifecycle
export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

// event:agent payload — streaming text chunks
export interface AgentEvent {
  runId: string;
  seq: number;
  stream?: string;           // stream name, e.g. "assistant"
  ts?: number;
  sessionKey?: string;
  data?: {
    delta?: string;          // incremental text chunk
    text?: string;           // full accumulated text so far
    [key: string]: unknown;
  };
}

export const ConnectionState = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  AUTH_FAILED: "AUTH_FAILED",
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

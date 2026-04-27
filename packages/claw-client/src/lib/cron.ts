"use client";

export type CronJobRecord = {
  id: string;
  name: string;
  description?: string;
  /** Top-level prompt some gateway versions populate. The actual cron-job
   * prompt is normally inside `payload.message` (see below) — UI reads from
   * payload first, then falls back to these. */
  prompt?: string;
  agentId?: string;
  enabled: boolean;
  sessionKey?: string;
  threadId?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  schedule?: {
    kind: string;
    at?: string;
    everyMs?: number;
    expr?: string;
    tz?: string;
  };
  /**
   * Where openclaw actually stores the agent prompt for a cron job
   * (`payload.message`). The job is invoked as an "agentTurn" with this text.
   */
  payload?: {
    kind?: string;
    message?: string;
    timeoutSeconds?: number;
  };
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastError?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastDeliveryStatus?: string;
  };
};

export type CronRunEntry = {
  ts: number;
  jobId: string;
  jobName?: string;
  status?: string;
  error?: string;
  summary?: string;
  delivered?: boolean;
  deliveryStatus?: string;
  deliveryError?: string;
  sessionId?: string;
  sessionKey?: string;
  threadId?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
};

export type CronStatusRecord = Record<string, unknown>;

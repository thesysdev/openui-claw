"use client";

export type CronJobRecord = {
  id: string;
  name: string;
  description?: string;
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

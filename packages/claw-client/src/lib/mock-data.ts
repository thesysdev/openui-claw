"use client";

import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import type {
  AppRecord,
  AppStore,
  AppSummary,
  ArtifactRecord,
  ArtifactStore,
  ArtifactSummary,
  StoredMessage,
} from "@/lib/engines/types";
import type { NotificationRecord } from "@/lib/notifications";
import type { ClawThreadListItem, ModelChoice, SessionRow } from "@/types/gateway-responses";

// Toggle to render the UI with rich seed data instead of empty/connection states.
// Keep this `false` for production / before commit.
export const USE_MOCK_DATA = true;

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

// ── Threads (agent chat sessions) ─────────────────────────────────────────────

export const MOCK_THREAD_LIST: ClawThreadListItem[] = [
  {
    id: "thread-research",
    title: "Research Agent",
    createdAt: NOW - 5 * 24 * 60 * 60 * 1000,
    clawKind: "main",
    clawAgentId: "research",
  },
  {
    id: "thread-research-2",
    title: "Q3 competitor scan",
    createdAt: NOW - 20 * 60 * 1000,
    clawKind: "extra",
    clawAgentId: "research",
  },
  {
    id: "thread-writer",
    title: "Writer Agent",
    createdAt: NOW - 3 * 60 * 60 * 1000,
    clawKind: "main",
    clawAgentId: "writer",
  },
  {
    id: "thread-data",
    title: "Data Analyst",
    createdAt: NOW - 8 * 60 * 60 * 1000,
    clawKind: "main",
    clawAgentId: "data",
  },
  {
    id: "thread-ops",
    title: "Ops Agent",
    createdAt: NOW - 26 * 60 * 60 * 1000,
    clawKind: "main",
    clawAgentId: "ops",
  },
];

export const MOCK_THREADS = MOCK_THREAD_LIST.map((t) => ({
  ...t,
  updatedAt: t.createdAt,
}));

export const MOCK_MESSAGES: Record<string, StoredMessage[]> = {
  "thread-research": [
    {
      id: "m-research-u1",
      role: "user",
      content: "Pull the top 5 industry articles from this week and summarize them.",
    },
    {
      id: "m-research-a1",
      role: "assistant",
      content:
        "Here are the top 5 articles from this week:\n\n1. **OpenAI o-series benchmarks**: New evals released, 87% on MMLU.\n2. **Anthropic Sonnet 4.6**: 1M context window now in beta.\n3. **Cloudflare Workers AI**: Edge inference latency cut 40%.\n4. **NVIDIA Blackwell**: First customer deliveries shipping next month.\n5. **AWS Bedrock**: Added support for fine-tuning open-weights models.\n\nWant me to dig deeper into any of them?",
    },
  ],
  "thread-research-2": [
    {
      id: "m-r2-u1",
      role: "user",
      content: "Run the competitor pricing scan and flag anything that changed.",
    },
    {
      id: "m-r2-a1",
      role: "assistant",
      content:
        "Got it. The scan errored — looks like the competitor's site rate-limited us. Setting up a retry in 1h with a different IP rotation. I'll let you know when it completes.",
      reasoning:
        "User wants the competitor pricing scan run again. Let me kick off the scan tool and watch for changes vs last week's snapshot.",
      timeline: [
        {
          type: "reasoning",
          text: "User wants the competitor pricing scan run again. Let me kick off the scan tool and watch for changes vs last week's snapshot.",
        },
        {
          type: "tool_call",
          toolCallId: "call-pricing-scan",
          toolName: "run_pricing_scan",
          args: '{"sites":["acme.com","contoso.com","initech.com"],"baseline":"2025-04-19"}',
        },
        {
          type: "tool_result",
          toolCallId: "call-pricing-scan",
          output:
            'Error 429: Too Many Requests\n  acme.com: rate-limited after 12 requests\n  contoso.com: ok (3 changes)\n  initech.com: rate-limited after 5 requests',
          isError: true,
          durationMs: 4820,
        },
        {
          type: "reasoning",
          text: "Two sites rate-limited us. I'll retry with longer delays and a rotated IP — schedule it for 1h from now so the rate limit window expires first.",
        },
        {
          type: "assistant_update",
          text: "Scheduling retry…",
        },
      ],
    },
  ],
  "thread-writer": [
    {
      id: "m-writer-u1",
      role: "user",
      content: "Draft the launch announcement for the Q3 release.",
    },
    {
      id: "m-writer-a1",
      role: "assistant",
      content:
        "Here's a first draft:\n\n> **Today we're shipping Q3** — a focused release that makes Claw faster, more reliable, and easier to extend. Highlights: 40% faster cold start, redesigned cron scheduling, and a new mobile experience.\n\nWant me to tighten the tone, add specific metrics, or include customer quotes?",
    },
    {
      id: "m-writer-u2",
      role: "user",
      content: "Tighten and add one customer quote.",
    },
  ],
  "thread-data": [
    {
      id: "m-data-u1",
      role: "user",
      content: "Refresh the Q3 dashboard with the latest revenue numbers.",
    },
    {
      id: "m-data-a1",
      role: "assistant",
      content:
        "Refreshed and published. Q3 revenue came in 12% above target, with the biggest contributor being the enterprise tier (+$2.1M ARR). The Finance Dashboard app now reflects the updated view.",
    },
  ],
  "thread-ops": [
    {
      id: "m-ops-u1",
      role: "user",
      content: "Check on the launch readiness — any blockers?",
    },
    {
      id: "m-ops-a1",
      role: "assistant",
      content:
        "Three open items in the Launch Tracker:\n\n• Docs review (assigned to Maya, due Friday)\n• Marketing site copy (in review)\n• Pricing page A/B variants (ready to ship)\n\nOn track for the announce date. Want me to nudge anyone?",
    },
  ],
};

// ── Apps ──────────────────────────────────────────────────────────────────────

export const MOCK_APPS: AppSummary[] = [
  {
    id: "app-finance-dashboard",
    title: "Finance Dashboard",
    agentId: "data",
    sessionKey: "data:thread-data",
    createdAt: ago(5 * 24 * 60 * 60 * 1000),
    updatedAt: ago(15 * 60 * 1000),
  },
  {
    id: "app-launch-tracker",
    title: "Launch Tracker",
    agentId: "ops",
    sessionKey: "ops:thread-ops",
    createdAt: ago(8 * 24 * 60 * 60 * 1000),
    updatedAt: ago(2 * 60 * 60 * 1000),
  },
  {
    id: "app-content-calendar",
    title: "Content Calendar",
    agentId: "writer",
    sessionKey: "writer:thread-writer",
    createdAt: ago(12 * 24 * 60 * 60 * 1000),
    updatedAt: ago(6 * 60 * 60 * 1000),
  },
  {
    id: "app-onboarding-wiki",
    title: "Onboarding Wiki",
    agentId: "writer",
    sessionKey: "writer:thread-writer",
    createdAt: ago(20 * 24 * 60 * 60 * 1000),
    updatedAt: ago(2 * 24 * 60 * 60 * 1000),
  },
];

export const MOCK_APP_STORE: AppStore = {
  async listApps() {
    return MOCK_APPS;
  },
  async getApp(id) {
    const summary = MOCK_APPS.find((a) => a.id === id);
    if (!summary) return null;
    return {
      ...summary,
      content: `<Card>Mock app: ${summary.title}</Card>`,
    } as unknown as AppRecord;
  },
  async deleteApp() {
    /* no-op */
  },
  async invokeTool() {
    return null;
  },
};

// ── Artifacts ─────────────────────────────────────────────────────────────────

export const MOCK_ARTIFACTS: ArtifactSummary[] = [
  {
    id: "artifact-q3-report",
    kind: "doc",
    title: "Q3 Research Report",
    source: { agentId: "research", sessionId: "thread-research" } as unknown as ArtifactSummary["source"],
    createdAt: ago(2 * 60 * 60 * 1000),
    updatedAt: ago(30 * 60 * 1000),
  },
  {
    id: "artifact-pricing-csv",
    kind: "csv",
    title: "Competitor Pricing",
    source: { agentId: "research", sessionId: "thread-research-2" } as unknown as ArtifactSummary["source"],
    createdAt: ago(4 * 60 * 60 * 1000),
    updatedAt: ago(3 * 60 * 60 * 1000),
  },
  {
    id: "artifact-launch-deck",
    kind: "doc",
    title: "Launch Deck Draft",
    source: { agentId: "writer", sessionId: "thread-writer" } as unknown as ArtifactSummary["source"],
    createdAt: ago(20 * 60 * 60 * 1000),
    updatedAt: ago(18 * 60 * 60 * 1000),
  },
  {
    id: "artifact-hero-image",
    kind: "image",
    title: "Hero Image v2",
    source: { agentId: "writer", sessionId: "thread-writer" } as unknown as ArtifactSummary["source"],
    createdAt: ago(2 * 24 * 60 * 60 * 1000),
    updatedAt: ago(1 * 24 * 60 * 60 * 1000),
  },
];

export const MOCK_ARTIFACT_STORE: ArtifactStore = {
  async listArtifacts() {
    return MOCK_ARTIFACTS;
  },
  async getArtifact(id) {
    const summary = MOCK_ARTIFACTS.find((a) => a.id === id);
    if (!summary) return null;
    return {
      ...summary,
      content: `# ${summary.title}\n\nMock content for ${summary.title}.`,
      metadata: {},
    } as unknown as ArtifactRecord;
  },
  async deleteArtifact() {
    /* no-op */
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: "notif-1",
    kind: "needs_input",
    title: "Approve outbound email",
    message: "Writer Agent drafted the launch announcement and needs your sign-off before sending.",
    unread: true,
    createdAt: ago(8 * 60 * 1000),
    updatedAt: ago(8 * 60 * 1000),
    target: { view: "chat", sessionId: "thread-writer" },
    source: { agentId: "writer", sessionKey: "writer:thread-writer" },
  },
  {
    id: "notif-2",
    kind: "cron_completed",
    title: "Daily research digest ready",
    message: "Cron run finished — 12 new items summarized in Q3 Research Report.",
    unread: true,
    createdAt: ago(45 * 60 * 1000),
    updatedAt: ago(45 * 60 * 1000),
    target: { view: "artifact", artifactId: "artifact-q3-report" },
    source: { agentId: "research", cronId: "cron-research-daily" },
  },
  {
    id: "notif-3",
    kind: "cron_failed",
    title: "Pricing scan failed",
    message: "Run errored: rate limited by competitor site. Will retry in 1h.",
    unread: true,
    createdAt: ago(2 * 60 * 60 * 1000),
    updatedAt: ago(2 * 60 * 60 * 1000),
    target: { view: "chat", sessionId: "thread-research-2" },
    source: { agentId: "research", cronId: "cron-pricing-scan" },
  },
  {
    id: "notif-4",
    kind: "task_done",
    title: "Finance Dashboard updated",
    message: "Data Analyst refreshed Q3 numbers and published a new view.",
    unread: false,
    createdAt: ago(5 * 60 * 60 * 1000),
    updatedAt: ago(5 * 60 * 60 * 1000),
    target: { view: "app", appId: "app-finance-dashboard" },
    source: { agentId: "data" },
  },
];

// ── Cron jobs ─────────────────────────────────────────────────────────────────

export const MOCK_CRON_JOBS: CronJobRecord[] = [
  {
    id: "cron-research-daily",
    name: "Daily research digest",
    description: "Pull top items from research feeds and post a summary.",
    enabled: true,
    sessionKey: "research:thread-research",
    threadId: "thread-research",
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "America/Los_Angeles" },
    state: { nextRunAtMs: NOW + 4 * 60 * 60 * 1000, lastRunAtMs: NOW - 20 * 60 * 60 * 1000 },
  },
  {
    id: "cron-pricing-scan",
    name: "Competitor pricing scan",
    description: "Scrape pricing pages every 6h and flag changes.",
    enabled: true,
    sessionKey: "research:thread-research-2",
    threadId: "thread-research-2",
    schedule: { kind: "interval", everyMs: 6 * 60 * 60 * 1000 },
    state: { lastRunStatus: "failed", lastError: "Rate limited" },
  },
  {
    id: "cron-weekly-launch",
    name: "Launch readiness check",
    description: "Roll up open items from Launch Tracker app.",
    enabled: false,
    sessionKey: "ops:thread-ops",
    threadId: "thread-ops",
    schedule: { kind: "cron", expr: "0 17 * * FRI" },
  },
];

// ── Models + per-session meta (drives ContextRing) ───────────────────────────

export const MOCK_AVAILABLE_MODELS: ModelChoice[] = [
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "anthropic",
    contextWindow: 200_000,
    reasoning: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200_000,
    reasoning: false,
  },
];

export const MOCK_SESSION_META: SessionRow[] = [
  {
    key: "thread-research",
    label: "Research Agent",
    derivedTitle: "Research Agent",
    updatedAt: NOW - 2 * 60 * 1000,
    model: "claude-opus-4-7",
    modelProvider: "anthropic",
    contextTokens: 47_400,
    totalTokens: 51_200,
    inputTokens: 38_900,
    outputTokens: 12_300,
  },
  {
    key: "thread-research-2",
    label: "Q3 competitor scan",
    derivedTitle: "Q3 competitor scan",
    updatedAt: NOW - 20 * 60 * 1000,
    model: "claude-opus-4-7",
    modelProvider: "anthropic",
    contextTokens: 142_800,
    totalTokens: 156_400,
    inputTokens: 118_200,
    outputTokens: 38_200,
  },
  {
    key: "thread-writer",
    label: "Writer Agent",
    derivedTitle: "Writer Agent",
    updatedAt: NOW - 3 * 60 * 60 * 1000,
    model: "claude-sonnet-4-6",
    modelProvider: "anthropic",
    contextTokens: 178_500,
    totalTokens: 184_900,
    inputTokens: 152_100,
    outputTokens: 32_800,
  },
  {
    key: "thread-data",
    label: "Data Analyst",
    derivedTitle: "Data Analyst",
    updatedAt: NOW - 8 * 60 * 60 * 1000,
    model: "claude-sonnet-4-6",
    modelProvider: "anthropic",
    contextTokens: 12_300,
    totalTokens: 14_800,
    inputTokens: 9_800,
    outputTokens: 5_000,
  },
  {
    key: "thread-ops",
    label: "Ops Agent",
    derivedTitle: "Ops Agent",
    updatedAt: NOW - 26 * 60 * 60 * 1000,
    model: "claude-sonnet-4-6",
    modelProvider: "anthropic",
    contextTokens: 6_400,
    totalTokens: 7_900,
    inputTokens: 5_100,
    outputTokens: 2_800,
  },
];

export const MOCK_CRON_RUNS: CronRunEntry[] = [
  {
    ts: NOW - 20 * 60 * 60 * 1000,
    jobId: "cron-research-daily",
    jobName: "Daily research digest",
    status: "completed",
    summary: "12 items summarized",
    delivered: true,
  },
  {
    ts: NOW - 2 * 60 * 60 * 1000,
    jobId: "cron-pricing-scan",
    jobName: "Competitor pricing scan",
    status: "failed",
    error: "Rate limited",
    delivered: false,
  },
];

"use client";

import type { CSSProperties } from "react";
import { Clock3, Cpu, Pin } from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { NotificationRecord } from "@/lib/notifications";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";
import { useTheme } from "@/lib/hooks/useTheme";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { Row } from "@/components/ui/Row";
import { SectionHeader } from "@/components/ui/SectionHeader";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  height: "100%",
  overflowY: "auto",
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text-primary)",
};

const CONTAINER_STYLE: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "var(--sp-xl) var(--sp-xl)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sp-2xl)",
};

const GREETING_TITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "var(--fs-2xl)",
  fontWeight: "var(--fw-bold)",
  color: "var(--color-text-primary)",
  letterSpacing: "var(--ls-tight)",
};

const GREETING_SUB_STYLE: CSSProperties = {
  marginTop: 6,
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-md)",
  color: "var(--color-text-tertiary)",
};

const AGENTS_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "var(--sp-ml)",
};

const SPLIT_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "var(--sp-xl)",
};

const EMPTY_STATE_STYLE: CSSProperties = {
  padding: "var(--sp-xl)",
  borderRadius: "var(--r-l)",
  border: "1px dashed var(--color-border)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text-tertiary)",
  textAlign: "center",
};

// ── HELPERS ────────────────────────────────────────────────────────────────

function greet(hour: number): string {
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function formatDateTime(value?: number | string | null): string {
  if (value == null) return "Not scheduled";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not scheduled";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cronRunBadge(run: CronRunEntry): string | undefined {
  if (run.status === "error") return "Error";
  if (run.status === "skipped") return "Skipped";
  if (run.status === "ok") return "Completed";
  return undefined;
}

interface AgentAggregate {
  agentId: string;
  displayName: string;
  threadCount: number;
  unread: number;
}

function aggregateAgents(
  threads: Thread[],
  notifications: NotificationRecord[],
): AgentAggregate[] {
  const map = new Map<string, AgentAggregate>();
  for (const t of threads) {
    const anyT = t as Thread & { clawAgentId?: string; clawKind?: string };
    const aid = anyT.clawAgentId ?? t.id;
    let a = map.get(aid);
    if (!a) {
      a = { agentId: aid, displayName: aid, threadCount: 0, unread: 0 };
      map.set(aid, a);
    }
    a.threadCount += 1;
    if (anyT.clawKind === "main") a.displayName = t.title;
  }
  for (const n of notifications) {
    if (!n.unread) continue;
    const aid = n.source?.agentId;
    if (!aid) continue;
    const a = map.get(aid);
    if (a) a.unread += 1;
  }
  return [...map.values()];
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onClick,
}: {
  agent: AgentAggregate;
  onClick: () => void;
}) {
  return (
    <Card
      as="button"
      interactive
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-m)",
        alignItems: "flex-start",
        textAlign: "left",
      }}
    >
      <IconTile letter={agent.displayName} size="lg" category="agent" />
      <div style={{ width: "100%" }}>
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--fs-md)",
            fontWeight: "var(--fw-bold)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.displayName}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-xs)",
            color: "var(--color-text-tertiary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>
            {agent.threadCount} {agent.threadCount === 1 ? "session" : "sessions"}
          </span>
          {agent.unread > 0 ? (
            <span style={{ color: "var(--color-text-danger)" }}>
              {agent.unread} unread
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

interface HomeDashboardProps {
  threads: Thread[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  notifications: NotificationRecord[];
  cronJobs: CronJobRecord[];
  cronRuns: CronRunEntry[];
  cronStatus: CronStatusRecord | null;
  pinnedAppIds: Set<string>;
  onOpenThread: (threadId: string) => void;
  onOpenApp: (appId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenNotifications?: () => void;
}

export function HomeDashboard({
  threads,
  apps,
  artifacts,
  notifications,
  cronJobs,
  cronRuns,
  cronStatus,
  pinnedAppIds,
  onOpenThread,
  onOpenApp,
  onOpenArtifact,
}: HomeDashboardProps) {
  const { name } = useTheme();
  const pinnedApps = apps.filter((app) => pinnedAppIds.has(app.id));
  const topApps = pinnedApps.length > 0 ? pinnedApps : apps.slice(0, 6);
  const recentArtifacts = artifacts.slice(0, 3);
  const visibleCronJobs = cronJobs.slice(0, 3);
  const visibleCronRuns = cronRuns.slice(0, 3);
  const cronHeartbeat =
    typeof cronStatus?.["running"] === "boolean"
      ? cronStatus["running"]
        ? "Scheduler active"
        : "Scheduler idle"
      : "Automation status";

  const agents = aggregateAgents(threads, notifications).slice(0, 4);
  const greeting = greet(new Date().getHours());
  const who = name?.trim() || "there";

  return (
    <div style={PAGE_STYLE}>
      <div style={CONTAINER_STYLE}>
        <header>
          <h1 style={GREETING_TITLE_STYLE}>
            {greeting}, {who}
          </h1>
          <p style={GREETING_SUB_STYLE}>What would you like to work on today?</p>
        </header>

        {/* ── Top agents ── */}
        <section>
          <SectionHeader title="Top agents" />
          {agents.length === 0 ? (
            <div style={EMPTY_STATE_STYLE}>
              Agents and their sessions will appear here once you connect a gateway.
            </div>
          ) : (
            <div style={AGENTS_GRID_STYLE}>
              {agents.map((agent) => {
                const first = threads.find((t) => {
                  const anyT = t as Thread & { clawAgentId?: string };
                  return (anyT.clawAgentId ?? t.id) === agent.agentId;
                });
                return (
                  <AgentCard
                    key={agent.agentId}
                    agent={agent}
                    onClick={() => first && onOpenThread(first.id)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Top apps + Recent artifacts ── */}
        <section style={SPLIT_GRID_STYLE}>
          <Card>
            <SectionHeader
              title={pinnedApps.length > 0 ? "Pinned apps" : "Top apps"}
              action={
                pinnedApps.length > 0 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--color-accent)",
                      fontSize: "var(--fs-xs)",
                    }}
                  >
                    <Pin size={12} />
                    {pinnedApps.length}
                  </span>
                ) : null
              }
            />
            {topApps.length === 0 ? (
              <div style={EMPTY_STATE_STYLE}>
                Apps generated during conversations will appear here.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--sp-2xs)",
                }}
              >
                {topApps.map((app) => (
                  <Row
                    key={app.id}
                    icon={<IconTile letter={app.title} size="md" category="app" />}
                    title={app.title}
                    subtitle={app.agentId}
                    onClick={() => onOpenApp(app.id)}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Recent artifacts" />
            {recentArtifacts.length === 0 ? (
              <div style={EMPTY_STATE_STYLE}>
                Durable artifacts will appear here once an agent saves reports, files, or media.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2xs)" }}>
                {recentArtifacts.map((artifact) => (
                  <Row
                    key={artifact.id}
                    icon={<IconTile letter={artifact.title} size="md" category="artifact" />}
                    title={artifact.title}
                    subtitle={artifact.source.agentId}
                    onClick={() => onOpenArtifact(artifact.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>

        {/* ── Scheduled activity ── */}
        <section>
          <SectionHeader
            title="Scheduled activity"
            action={
              <span
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                {cronHeartbeat}
              </span>
            }
          />
          {visibleCronJobs.length === 0 && visibleCronRuns.length === 0 ? (
            <div style={EMPTY_STATE_STYLE}>
              Scheduled jobs and recent automation outcomes will appear here once cron is active.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2xs)" }}>
              {visibleCronJobs.map((job) => (
                <Row
                  key={job.id}
                  icon={<IconTile icon={<Clock3 size={14} />} size="md" category="activity" />}
                  title={job.name}
                  subtitle={
                    job.enabled
                      ? `Next run ${formatDateTime(job.state?.nextRunAtMs)}`
                      : "Disabled"
                  }
                  right={
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--r-s)",
                        fontSize: "var(--fs-2xs)",
                        color: "var(--color-text-tertiary)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {job.state?.lastRunStatus ?? (job.enabled ? "Scheduled" : "Off")}
                    </span>
                  }
                  onClick={() => {
                    if (job.threadId) onOpenThread(job.threadId);
                  }}
                />
              ))}
              {visibleCronRuns.map((run) => (
                <Row
                  key={`${run.jobId}:${run.ts}`}
                  icon={<IconTile icon={<Cpu size={14} />} size="md" category="activity" />}
                  title={run.jobName ?? run.jobId}
                  subtitle={
                    run.summary ?? run.error ?? `Last run ${formatDateTime(run.runAtMs ?? run.ts)}`
                  }
                  right={
                    cronRunBadge(run) ? (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "var(--r-s)",
                          fontSize: "var(--fs-2xs)",
                          color: "var(--color-text-tertiary)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {cronRunBadge(run)}
                      </span>
                    ) : undefined
                  }
                  onClick={() => {
                    if (run.threadId) onOpenThread(run.threadId);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default HomeDashboard;

"use client";

import {
  BellRing,
  Clock3,
  LayoutGrid,
  MessageSquareText,
  Pin,
  ScrollText,
} from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { NotificationRecord } from "@/lib/notifications";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";

function formatDateTime(value?: number | string | null): string {
  if (value == null) return "Not scheduled";
  const timestamp =
    typeof value === "number" ? value : new Date(value).getTime();
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  onClick?: () => void;
}) {
  const className =
    "rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/72";

  const content = (
    <>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 via-white to-sky-100 text-zinc-700 dark:from-zinc-800 dark:via-zinc-900 dark:to-sky-500/20 dark:text-zinc-100">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
    </>
  );

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`${className} text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/82 p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/72">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({
  icon: Icon,
  title,
  subtitle,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 via-white to-sky-100 text-zinc-700 dark:from-zinc-800 dark:via-zinc-900 dark:to-sky-500/20 dark:text-zinc-100">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
          {title}
        </div>
        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </div>
      </div>
      {badge ? (
        <span className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {badge}
        </span>
      ) : null}
    </button>
  );
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
  onOpenNotifications,
}: {
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
}) {
  const pinnedApps = apps.filter((app) => pinnedAppIds.has(app.id));
  const recentApps = pinnedApps.length > 0 ? pinnedApps : apps.slice(0, 4);
  const recentThreads = threads.slice(0, 5);
  const recentArtifacts = artifacts.slice(0, 4);
  const unreadNotifications = notifications.filter((notification) => notification.unread);
  const visibleCronJobs = cronJobs.slice(0, 4);
  const visibleCronRuns = cronRuns.slice(0, 4);
  const cronHeartbeat =
    typeof cronStatus?.["running"] === "boolean"
      ? cronStatus["running"]
        ? "Scheduler active"
        : "Scheduler idle"
      : "Automation status";

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_28%),linear-gradient(to_bottom,_rgba(255,255,255,0.94),_rgba(248,250,252,0.98))] dark:bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),radial-gradient(circle_at_top_left,_rgba(71,85,105,0.14),_transparent_26%),linear-gradient(to_bottom,_rgba(9,9,11,0.96),_rgba(9,9,11,0.98))]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
              OpenUI Claw
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Home
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Conversations create durable apps and artifacts. This dashboard keeps the workspace state visible before you dive back into a thread.
            </p>
          </div>
        </div>

        {onOpenNotifications ? (
          <div className="mb-6 xl:hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={onOpenNotifications}
            >
              <span className="inline-flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                Notifications
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                {unreadNotifications.length}
              </span>
            </button>
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={MessageSquareText}
            label="Threads"
            value={threads.length}
            hint="Recent chats and agent sessions"
          />
          <StatCard
            icon={LayoutGrid}
            label="Apps"
            value={apps.length}
            hint="Durable interfaces created by agents"
          />
          <StatCard
            icon={ScrollText}
            label="Artifacts"
            value={artifacts.length}
            hint="Saved documents, files, and outputs"
          />
          <StatCard
            icon={BellRing}
            label="Unread"
            value={unreadNotifications.length}
            hint="Notifications that still need your attention"
            onClick={onOpenNotifications}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Recent Conversations">
            <div className="space-y-1">
              {recentThreads.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Once you start or open a thread, it will show up here for quick return.
                </p>
              ) : (
                recentThreads.map((thread) => (
                  <Row
                    key={thread.id}
                    icon={Clock3}
                    title={thread.title}
                    subtitle="Open chat session"
                    onClick={() => onOpenThread(thread.id)}
                  />
                ))
              )}
            </div>
          </Section>

          <Section title="Recent Artifacts">
            <div className="space-y-1">
              {recentArtifacts.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Durable artifacts will appear here once an agent saves reports, files, or media.
                </p>
              ) : (
                recentArtifacts.map((artifact) => (
                  <Row
                    key={artifact.id}
                    icon={ScrollText}
                    title={artifact.title}
                    subtitle={artifact.source.agentId}
                    badge={artifact.kind}
                    onClick={() => onOpenArtifact(artifact.id)}
                  />
                ))
              )}
            </div>
          </Section>

          <Section
            title="Scheduled Activity"
            action={
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {cronHeartbeat}
              </span>
            }
          >
            <div className="space-y-1">
              {visibleCronJobs.length === 0 && visibleCronRuns.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Scheduled jobs and recent automation outcomes will appear here once cron is active.
                </p>
              ) : (
                <>
                  {visibleCronJobs.map((job) => (
                    <Row
                      key={job.id}
                      icon={Clock3}
                      title={job.name}
                      subtitle={
                        job.enabled
                          ? `Next run ${formatDateTime(job.state?.nextRunAtMs)}`
                          : "Disabled"
                      }
                      badge={job.state?.lastRunStatus ?? (job.enabled ? "Scheduled" : "Off")}
                      onClick={() => {
                        if (job.threadId) onOpenThread(job.threadId);
                      }}
                    />
                  ))}
                  {visibleCronRuns.map((run) => (
                    <Row
                      key={`${run.jobId}:${run.ts}`}
                      icon={BellRing}
                      title={run.jobName ?? run.jobId}
                      subtitle={
                        run.summary ??
                        run.error ??
                        `Last run ${formatDateTime(run.runAtMs ?? run.ts)}`
                      }
                      badge={cronRunBadge(run)}
                      onClick={() => {
                        if (run.threadId) onOpenThread(run.threadId);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          </Section>

          <div className="xl:col-span-2">
            <Section
              title={pinnedApps.length > 0 ? "Pinned Apps" : "Recent Apps"}
              action={
                pinnedApps.length > 0 ? (
                  <div className="inline-flex items-center gap-1 text-xs text-sky-500">
                    <Pin className="h-3.5 w-3.5" />
                    {pinnedApps.length}
                  </div>
                ) : null
              }
            >
              <div className="space-y-1">
                {recentApps.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    Apps generated during conversations will appear here and remain easy to revisit.
                  </p>
                ) : (
                  recentApps.map((app) => (
                    <Row
                      key={app.id}
                      icon={LayoutGrid}
                      title={app.title}
                      subtitle={app.agentId}
                      badge={pinnedAppIds.has(app.id) ? "Pinned" : undefined}
                      onClick={() => onOpenApp(app.id)}
                    />
                  ))
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

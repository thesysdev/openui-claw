"use client";

import {
  ChevronRight,
  Clock3,
  Cpu,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  ScrollText,
  Table2,
} from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import { useMemo } from "react";

import { AgentCard, type AgentCardData } from "@/components/cards/AgentCard";
import { Button } from "@/components/ui/Button";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import type { NotificationRecord } from "@/lib/notifications";
import type { ClawThread } from "@/types/claw-thread";

import { Greeting } from "./Greeting";
import { HomeRow } from "./HomeRow";
import { SectionHeader } from "./SectionHeader";
import { NotifPanel } from "./notif/NotifPanel";
import type { HomeNotif, NotifType } from "./notif/types";

// ────────────────────────────────────────────────────────────────────────────
// Adapters: real app data → homepage view-models
// ────────────────────────────────────────────────────────────────────────────

/** Group `ClawThread[]` by agent — mirrors sidebar's buildAgentGroups. */
function buildAgents(threads: ClawThread[]): AgentCardData[] {
  const map = new Map<string, { id: string; name: string; threadCount: number }>();
  for (const t of threads) {
    const id = t.clawAgentId ?? t.id;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { id, name: t.clawKind === "main" ? t.title : id, threadCount: 1 });
    } else {
      existing.threadCount += 1;
      if (t.clawKind === "main") existing.name = t.title;
    }
  }
  return [...map.values()].map((g) => ({
    id: g.id,
    name: g.name,
    icon: Cpu,
    status: "idle",
    unread: 0,
  }));
}

const ARTIFACT_ICON: Record<string, typeof FileText> = {
  doc: FileText,
  csv: Table2,
  image: ImageIcon,
};

function notifTypeFromKind(kind: string): NotifType {
  const k = kind.toLowerCase();
  if (k.includes("needs_input") || k.includes("approval") || k.includes("input_needed")) {
    return "needs_input";
  }
  if (k.includes("error") || k.includes("failed") || k.includes("alert")) {
    return "alert";
  }
  return "task";
}

function toHomeNotif(n: NotificationRecord): HomeNotif {
  return {
    id: n.id,
    type: notifTypeFromKind(n.kind),
    title: n.title,
    desc: n.message,
    time: Date.parse(n.createdAt),
    read: !n.unread,
    agent: n.source?.agentId,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Scheduled activity (cron)
// ────────────────────────────────────────────────────────────────────────────

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * "agent / session" label for a cron job, derived from `sessionKey` (the
 * leading `agent:` segment) and the thread title looked up via `threadId`.
 * Each of the two parts is truncated to 48 chars independently.
 */
function cronOwnerLabel(job: CronJobRecord, threads: Thread[]): string {
  const sessionKey = job.sessionKey ?? "";
  const agentPart = sessionKey.split(":")[0] ?? "";
  const thread = job.threadId ? threads.find((t) => t.id === job.threadId) : undefined;
  const sessionName = thread?.title ?? "";
  const agent = agentPart ? truncate(agentPart) : "";
  const session = sessionName ? truncate(sessionName) : "";
  if (agent && session) return `${agent} / ${session}`;
  return agent || session;
}

function humanFrequency(job: CronJobRecord): string {
  const s = job.schedule;
  if (!s) return "Manual";
  if (s.kind === "cron" && s.expr) return s.expr;
  if (s.kind === "interval" && s.everyMs) {
    const ms = s.everyMs;
    if (ms < 60 * 60 * 1000) return `Every ${Math.round(ms / 60000)} min`;
    if (ms < 24 * 60 * 60 * 1000) return `Every ${Math.round(ms / 3_600_000)} h`;
    return `Every ${Math.round(ms / 86_400_000)} d`;
  }
  return s.kind;
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────

export interface HomeViewProps {
  /** Real app data from useGateway. */
  threads: Thread[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  notifications: NotificationRecord[];
  cronJobs: CronJobRecord[];
  cronRuns: CronRunEntry[];
  userName?: string;
  onNavigate: (view: "agents" | "apps" | "artifacts") => void;
  onOpenThread: (threadId: string) => void;
  onOpenApp: (appId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenNotif?: (notifId: string) => void;
  onMarkNotifRead?: (notifId: string) => void;
}

export function HomeView({
  threads,
  apps,
  artifacts,
  notifications,
  cronJobs,
  userName,
  onNavigate,
  onOpenThread,
  onOpenApp,
  onOpenArtifact,
  onOpenNotif,
  onMarkNotifRead,
}: HomeViewProps) {
  const agents = useMemo(() => buildAgents(threads as ClawThread[]), [threads]);
  const homeNotifs = useMemo(() => notifications.map(toHomeNotif), [notifications]);
  const recentApps = useMemo(
    () => [...apps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [apps],
  );
  const recentArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [artifacts],
  );
  const visibleCrons = useMemo(() => cronJobs.slice(0, 3), [cronJobs]);

  const openAgent = (agent: AgentCardData) => {
    const main = (threads as ClawThread[]).find(
      (t) => (t.clawAgentId ?? t.id) === agent.id && t.clawKind === "main",
    );
    if (main) onOpenThread(main.id);
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background">
      {/* ── Main scroll area ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] px-3xl py-3xl">
          <Greeting name={userName} />

          {/* Top agents */}
          <section className="mb-ml">
            <SectionHeader title="Top agents" />
            {agents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
                No agents yet. Start a conversation to see them here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-ml sm:grid-cols-3 lg:grid-cols-4">
                {agents.slice(0, 4).map((a) => (
                  <AgentCard key={a.id} agent={a} onClick={() => openAgent(a)} />
                ))}
              </div>
            )}
            {agents.length > 4 ? (
              <div className="mt-m">
                <Button
                  variant="borderless"
                  size="sm"
                  icon={ChevronRight}
                  iconTrailing
                  onClick={() => onNavigate("agents")}
                >
                  View all {agents.length}
                </Button>
              </div>
            ) : null}
          </section>

          {/* Top apps + Recent artifacts */}
          <section className="mb-ml grid grid-cols-1 gap-ml lg:grid-cols-[2fr_1fr]">
            {/* Top apps */}
            <div className="rounded-2xl border border-border-default/50 bg-popover-background p-ml shadow-xl dark:border-transparent dark:bg-foreground">
              <SectionHeader title="Top apps" />
              {recentApps.length === 0 ? (
                <p className="font-body text-sm text-text-neutral-tertiary">
                  Agents will create apps here as you chat.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-x-xl sm:grid-cols-2">
                  {recentApps.slice(0, 6).map((app) => (
                    <HomeRow
                      key={app.id}
                      icon={LayoutGrid}
                      title={app.title}
                      subtitle={`by ${truncate(app.agentId)}`}
                      category="app"
                      onClick={() => onOpenApp(app.id)}
                    />
                  ))}
                </div>
              )}
              {recentApps.length > 6 ? (
                <div className="mt-m">
                  <Button
                    variant="borderless"
                    size="sm"
                    icon={ChevronRight}
                    iconTrailing
                    onClick={() => onNavigate("apps")}
                  >
                    View all {recentApps.length}
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Recent artifacts */}
            <div className="rounded-2xl border border-border-default/50 bg-popover-background p-ml shadow-xl dark:border-transparent dark:bg-foreground">
              <SectionHeader title="Recent artifacts" />
              {recentArtifacts.length === 0 ? (
                <p className="font-body text-sm text-text-neutral-tertiary">
                  Saved documents and files will appear here.
                </p>
              ) : (
                recentArtifacts.slice(0, 3).map((art) => {
                  const Icon = ARTIFACT_ICON[art.kind] ?? ScrollText;
                  return (
                    <HomeRow
                      key={art.id}
                      icon={Icon}
                      title={art.title}
                      subtitle={`by ${truncate(art.source.agentId)}`}
                      category="artifact"
                      onClick={() => onOpenArtifact(art.id)}
                    />
                  );
                })
              )}
              {recentArtifacts.length > 3 ? (
                <div className="mt-m">
                  <Button
                    variant="borderless"
                    size="sm"
                    icon={ChevronRight}
                    iconTrailing
                    onClick={() => onNavigate("artifacts")}
                  >
                    View all {recentArtifacts.length}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          {/* Scheduled activity */}
          <section className="mt-2xl mb-3xl">
            <SectionHeader title="Scheduled activity" />
            {visibleCrons.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
                Scheduled jobs will appear here once cron is active.
              </p>
            ) : (
              <div className="space-y-xs">
                {visibleCrons.map((job) => {
                  const ownerLabel = cronOwnerLabel(job, threads);
                  const freq = humanFrequency(job);
                  return (
                    <HomeRow
                      key={job.id}
                      icon={Clock3}
                      title={job.name}
                      subtitle={
                        <>
                          <span className="text-cat-activity">{freq}</span>
                          {ownerLabel ? (
                            <>
                              <span className="mx-2xs inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-text-neutral-tertiary/50 align-middle" />
                              <span>by {ownerLabel}</span>
                            </>
                          ) : null}
                        </>
                      }
                      category="activity"
                      onClick={() => {
                        if (job.threadId) onOpenThread(job.threadId);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Notifications panel ── */}
      <NotifPanel
        notifications={homeNotifs}
        onOpenNotif={(n) => onOpenNotif?.(n.id)}
        onMarkRead={(id) => onMarkNotifRead?.(id)}
        onAction={(n) => onOpenNotif?.(n.id)}
      />
    </div>
  );
}

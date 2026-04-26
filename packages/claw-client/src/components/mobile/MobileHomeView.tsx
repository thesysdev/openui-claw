"use client";

import {
  Clock3,
  Cpu,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  ScrollText,
  Table2,
} from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import { useMemo } from "react";

import { AgentCard, type AgentCardData } from "@/components/cards/AgentCard";
import { Greeting } from "@/components/home/Greeting";
import { SectionHeader } from "@/components/home/SectionHeader";
import type { HomeViewProps } from "@/components/home/HomeView";
import { MobileButton } from "@/components/mobile/MobileButton";
import { MobileListCard, MobileListRow } from "@/components/mobile/MobileListRow";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { navigate } from "@/lib/hooks/useHashRoute";
import type { CronJobRecord } from "@/lib/cron";
import type { ClawThread } from "@/types/claw-thread";

const ARTIFACT_ICON: Record<string, typeof FileText> = {
  doc: FileText,
  csv: Table2,
  image: ImageIcon,
};

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

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

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

function ViewAllButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <MobileButton variant="secondary" fullWidth onClick={onClick} className="mt-s">
      <span>View all</span>
      <Counter size="md" color="neutral" kind="secondary">
        {count}
      </Counter>
    </MobileButton>
  );
}

export function MobileHomeView({
  threads,
  apps,
  artifacts,
  cronJobs,
  userName,
  onNavigate,
  onOpenThread,
  onOpenApp,
  onOpenArtifact,
}: HomeViewProps) {
  const agents = useMemo(() => buildAgents(threads as ClawThread[]), [threads]);
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
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] px-ml py-ml">
          <Greeting name={userName} />

          <section className="mb-ml">
            <SectionHeader title="Top agents" />
            {agents.length === 0 ? (
              <div className="flex min-h-[130px] flex-col items-center justify-center gap-m rounded-2xl border border-dashed border-border-default px-ml text-sm text-text-neutral-tertiary">
                <p>Get work done with your first agent.</p>
                <Button variant="primary" size="md" icon={Plus}>
                  Create agent
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-s">
                  {agents.slice(0, 4).map((a) => (
                    <AgentCard key={a.id} agent={a} onClick={() => openAgent(a)} />
                  ))}
                </div>
                <ViewAllButton count={agents.length} onClick={() => onNavigate("agents")} />
              </>
            )}
          </section>

          <section className="mb-ml">
            <SectionHeader title="Top apps" />
            {recentApps.length === 0 ? (
              <div className="flex min-h-[150px] flex-col items-center justify-center gap-m rounded-2xl border border-dashed border-border-default/70 px-ml text-center font-body text-sm text-text-neutral-tertiary dark:border-border-default">
                <p>
                  Ask your agent to create dashboards,
                  <br />
                  work trackers, marketing calendars, etc.
                </p>
                <Button variant="secondary" size="md">
                  See an example
                </Button>
              </div>
            ) : (
              <MobileListCard>
                {recentApps.slice(0, 6).map((app) => (
                  <MobileListRow
                    key={app.id}
                    icon={LayoutGrid}
                    title={app.title}
                    subtitle={`by ${truncate(app.agentId)}`}
                    category="app"
                    onClick={() => onOpenApp(app.id)}
                  />
                ))}
              </MobileListCard>
            )}
            {recentApps.length > 0 ? (
              <ViewAllButton count={recentApps.length} onClick={() => onNavigate("apps")} />
            ) : null}
          </section>

          <section className="mb-ml">
            <SectionHeader title="Recent artifacts" />
            {recentArtifacts.length === 0 ? (
              <div className="flex min-h-[150px] flex-col items-center justify-center gap-m rounded-2xl border border-dashed border-border-default/70 px-ml text-center font-body text-sm text-text-neutral-tertiary dark:border-border-default">
                <p>
                  Ask your agent to create
                  <br />
                  slides and reports.
                </p>
                <Button variant="secondary" size="md">
                  See an example
                </Button>
              </div>
            ) : (
              <MobileListCard>
                {recentArtifacts.slice(0, 3).map((art) => {
                  const Icon = ARTIFACT_ICON[art.kind] ?? ScrollText;
                  return (
                    <MobileListRow
                      key={art.id}
                      icon={Icon}
                      title={art.title}
                      subtitle={`by ${truncate(art.source.agentId)}`}
                      category="artifact"
                      onClick={() => onOpenArtifact(art.id)}
                    />
                  );
                })}
              </MobileListCard>
            )}
            {recentArtifacts.length > 0 ? (
              <ViewAllButton
                count={recentArtifacts.length}
                onClick={() => onNavigate("artifacts")}
              />
            ) : null}
          </section>

          <section className="mb-3xl">
            <SectionHeader title="Cron Jobs" />
            {visibleCrons.length === 0 ? (
              <div className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-border-default px-ml text-center text-sm text-text-neutral-tertiary">
                <p>
                  Ask your agent to schedule recurring jobs
                  <br />
                  like daily digests or weekly reports.
                </p>
              </div>
            ) : (
              <MobileListCard>
                {visibleCrons.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate({ view: "crons", selectedId: job.id })}
                    className="flex min-h-[64px] w-full items-center gap-m bg-transparent px-ml py-m text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light"
                  >
                    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m bg-cat-activity/10">
                      <Clock3 size={14} className="text-cat-activity" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-medium text-text-neutral-primary">
                        {job.name}
                      </p>
                      <p className="truncate font-body text-2xs text-text-neutral-tertiary/70">
                        <span className="text-cat-activity">{humanFrequency(job)}</span>
                        {cronOwnerLabel(job, threads) ? (
                          <>
                            <span className="mx-2xs inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-text-neutral-tertiary/50 align-middle" />
                            <span>by {cronOwnerLabel(job, threads)}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </button>
                ))}
              </MobileListCard>
            )}
            {cronJobs.length > 0 ? (
              <ViewAllButton count={cronJobs.length} onClick={() => onNavigate("crons")} />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Clock3, X } from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/home/SectionHeader";
import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { Tag } from "@/components/layout/sidebar/Tag";
import { MobileListCard, MobileListRow } from "@/components/mobile/MobileListRow";
import { SortButton } from "@/components/ui/SortButton";
import { CronDetailTray, type CronJobEdits } from "@/components/crons/CronDetailTray";
import { cronOwnerLabel, humanFrequency } from "@/components/crons/format";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";

type Sort = "recent" | "a-z";

export interface CronsViewProps {
  cronJobs: CronJobRecord[];
  runs: CronRunEntry[];
  threads: Thread[];
  initialSelectedId?: string;
  onOpenThread: (threadId: string) => void;
}

export function MobileCronsView({
  cronJobs,
  runs,
  threads,
  initialSelectedId,
  onOpenThread,
}: CronsViewProps) {
  const [sort, setSort] = useState<Sort>("recent");
  const [overlay, setOverlay] = useState<Record<string, Partial<CronJobRecord>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  const mergedJobs = useMemo(
    () =>
      cronJobs
        .filter((j) => !deletedIds.has(j.id))
        .map((j) => ({ ...j, ...(overlay[j.id] ?? {}) })),
    [cronJobs, overlay, deletedIds],
  );

  const sorted = useMemo(() => {
    const arr = [...mergedJobs];
    if (sort === "a-z") arr.sort((a, b) => a.name.localeCompare(b.name));
    else
      arr.sort(
        (a, b) =>
          (b.updatedAtMs ?? b.createdAtMs ?? 0) - (a.updatedAtMs ?? a.createdAtMs ?? 0),
      );
    return arr;
  }, [mergedJobs, sort]);

  const selected = useMemo(
    () => mergedJobs.find((j) => j.id === selectedId) ?? null,
    [mergedJobs, selectedId],
  );

  const patch = useCallback((id: string, fields: Partial<CronJobRecord>) => {
    setOverlay((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? {}), ...fields, updatedAtMs: Date.now() },
    }));
  }, []);

  const handleRunNow = useCallback(
    (job: CronJobRecord) => {
      patch(job.id, { updatedAtMs: Date.now() });
    },
    [patch],
  );

  const handleToggleEnabled = useCallback(
    (job: CronJobRecord, nextEnabled: boolean) => {
      patch(job.id, { enabled: nextEnabled });
    },
    [patch],
  );

  const handleSaveEdits = useCallback(
    (job: CronJobRecord, edits: CronJobEdits) => {
      const nextSchedule =
        edits.scheduleExpr && edits.scheduleExpr !== job.schedule?.expr
          ? { ...(job.schedule ?? { kind: "cron" }), kind: "cron", expr: edits.scheduleExpr }
          : job.schedule;
      patch(job.id, {
        name: edits.name ?? job.name,
        description: edits.prompt ?? job.description,
        schedule: nextSchedule,
      });
    },
    [patch],
  );

  const handleDelete = useCallback((job: CronJobRecord) => {
    setDeletedIds((curr) => new Set([...curr, job.id]));
    setSelectedId(null);
  }, []);

  const handleDuplicate = useCallback((job: CronJobRecord) => {
    const id = `${job.id}-copy-${Date.now()}`;
    setOverlay((curr) => ({
      ...curr,
      [id]: {
        ...job,
        id,
        name: `${job.name} (copy)`,
        enabled: false,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      },
    }));
    setSelectedId(id);
  }, []);

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background">
      <div className="min-w-0 flex-1 overflow-y-auto p-ml">
        <div className="mx-auto max-w-[1080px]">
          {sorted.length === 0 ? (
            <div className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-border-default px-ml text-center text-sm text-text-neutral-tertiary">
              <p>
                Ask your agent to schedule recurring jobs
                <br />
                like daily digests or weekly reports.
              </p>
            </div>
          ) : (
            <section className="mb-3xl">
              <SectionHeader
                title="All cron jobs"
                right={<SortButton value={sort} onChange={setSort} />}
              />
              <MobileListCard>
                {sorted.map((job) => {
                  const owner = cronOwnerLabel(job, threads);
                  const subtitle = owner
                    ? `${humanFrequency(job)} · by ${owner}`
                    : humanFrequency(job);
                  return (
                    <MobileListRow
                      key={job.id}
                      icon={Clock3}
                      title={job.name}
                      subtitle={subtitle}
                      category="activity"
                      right={
                        <Tag size="md" variant={job.enabled ? "success" : "neutral"}>
                          {job.enabled ? "Active" : "Paused"}
                        </Tag>
                      }
                      onClick={() => setSelectedId(job.id)}
                    />
                  );
                })}
              </MobileListCard>
            </section>
          )}
        </div>
      </div>

      {selected ? (
        <MobileCronDetailOverlay
          job={selected}
          runs={runs}
          threads={threads}
          onClose={() => setSelectedId(null)}
          onRunNow={handleRunNow}
          onToggleEnabled={handleToggleEnabled}
          onSaveEdits={handleSaveEdits}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onOpenThread={onOpenThread}
        />
      ) : null}
    </div>
  );
}

function MobileCronDetailOverlay({
  job,
  runs,
  threads,
  onClose,
  onRunNow,
  onToggleEnabled,
  onSaveEdits,
  onDelete,
  onDuplicate,
  onOpenThread,
}: {
  job: CronJobRecord;
  runs: CronRunEntry[];
  threads: Thread[];
  onClose: () => void;
  onRunNow: (job: CronJobRecord) => void;
  onToggleEnabled: (job: CronJobRecord, next: boolean) => void;
  onSaveEdits: (job: CronJobRecord, edits: CronJobEdits) => void;
  onDelete: (job: CronJobRecord) => void;
  onDuplicate: (job: CronJobRecord) => void;
  onOpenThread: (threadId: string) => void;
}) {
  useBodyScrollLock(true);
  const [vw, setVw] = useState<number>(() =>
    typeof window === "undefined" ? 360 : window.innerWidth,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background dark:bg-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-m border-b border-border-default/70 bg-background px-ml py-s dark:border-border-default/16 dark:bg-foreground">
        <h2 className="min-w-0 truncate font-heading text-md font-medium text-text-neutral-primary">
          {job.name}
        </h2>
        <HeaderIconButton onClick={onClose} label="Close cron job">
          <X size={16} />
        </HeaderIconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CronDetailTray
          job={job}
          runs={runs}
          threads={threads}
          width={vw}
          onDragStart={() => {}}
          onClose={onClose}
          onRunNow={onRunNow}
          onToggleEnabled={onToggleEnabled}
          onSaveEdits={onSaveEdits}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onOpenThread={onOpenThread}
        />
      </div>
    </div>
  );
}

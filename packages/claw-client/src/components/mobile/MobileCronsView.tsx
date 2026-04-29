"use client";

import type { Thread } from "@openuidev/react-headless";
import { MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CronDetailTray, type CronJobEdits } from "@/components/crons/CronDetailTray";
import { SectionHeader } from "@/components/home/SectionHeader";
import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileCronRow } from "@/components/mobile/MobileCronRow";
import { MobileDetailHeader } from "@/components/mobile/MobileDetailHeader";
import { MobileListCard } from "@/components/mobile/MobileListRow";
import { MobileMenuDrawer } from "@/components/mobile/MobileMenuDrawer";
import { SortButton } from "@/components/ui/SortButton";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

type Sort = "recent" | "a-z";

export interface CronsViewProps {
  cronJobs: CronJobRecord[];
  runs: CronRunEntry[];
  threads: Thread[];
  initialSelectedId?: string;
  onOpenThread: (threadId: string) => void;
  onUpdateCronJob?: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  onRunCronJob?: (id: string, mode?: "force" | "due") => Promise<boolean>;
  onRemoveCronJob?: (id: string) => Promise<boolean>;
  onRefreshCronData?: () => Promise<unknown>;
}

export function MobileCronsView({
  cronJobs,
  runs,
  threads,
  initialSelectedId,
  onOpenThread,
  onUpdateCronJob,
  onRunCronJob,
  onRemoveCronJob,
  onRefreshCronData,
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
        (a, b) => (b.updatedAtMs ?? b.createdAtMs ?? 0) - (a.updatedAtMs ?? a.createdAtMs ?? 0),
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
    async (job: CronJobRecord) => {
      patch(job.id, { updatedAtMs: Date.now() });
      if (onRunCronJob) {
        const ok = await onRunCronJob(job.id, "force");
        if (ok && onRefreshCronData) await onRefreshCronData();
      }
    },
    [patch, onRunCronJob, onRefreshCronData],
  );

  const handleToggleEnabled = useCallback(
    async (job: CronJobRecord, nextEnabled: boolean) => {
      patch(job.id, { enabled: nextEnabled });
      if (!onUpdateCronJob) return;
      const ok = await onUpdateCronJob(job.id, { enabled: nextEnabled });
      if (!ok) {
        patch(job.id, { enabled: !nextEnabled });
        return;
      }
      if (onRefreshCronData) await onRefreshCronData();
    },
    [patch, onUpdateCronJob, onRefreshCronData],
  );

  const handleSaveEdits = useCallback(
    async (job: CronJobRecord, edits: CronJobEdits) => {
      const nextSchedule =
        edits.scheduleExpr && edits.scheduleExpr !== job.schedule?.expr
          ? { ...(job.schedule ?? { kind: "cron" }), kind: "cron", expr: edits.scheduleExpr }
          : job.schedule;
      patch(job.id, {
        name: edits.name ?? job.name,
        description: edits.prompt ?? job.description,
        schedule: nextSchedule,
      });
      if (!onUpdateCronJob) return;
      const serverPatch: Record<string, unknown> = {};
      if (edits.name !== undefined) serverPatch["name"] = edits.name;
      if (edits.prompt !== undefined) {
        serverPatch["payload"] = { ...(job.payload ?? {}), message: edits.prompt };
      }
      if (edits.scheduleExpr && edits.scheduleExpr !== job.schedule?.expr) {
        serverPatch["schedule"] = nextSchedule;
      }
      if (Object.keys(serverPatch).length === 0) return;
      const ok = await onUpdateCronJob(job.id, serverPatch);
      if (ok && onRefreshCronData) await onRefreshCronData();
    },
    [patch, onUpdateCronJob, onRefreshCronData],
  );

  const handleDelete = useCallback(
    async (job: CronJobRecord) => {
      setDeletedIds((curr) => new Set([...curr, job.id]));
      setSelectedId(null);
      if (!onRemoveCronJob) return;
      const ok = await onRemoveCronJob(job.id);
      if (!ok) {
        setDeletedIds((curr) => {
          const next = new Set(curr);
          next.delete(job.id);
          return next;
        });
        return;
      }
      if (onRefreshCronData) await onRefreshCronData();
    },
    [onRemoveCronJob, onRefreshCronData],
  );

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
    <div className="claw-fade-in flex h-full flex-1 overflow-hidden bg-background">
      {sorted.length === 0 ? (
        <div
          className="flex h-full flex-1 items-center justify-center p-ml"
          style={{ minHeight: "calc(100dvh - 120px)" }}
        >
          <p className="text-center text-sm text-text-neutral-tertiary">
            Ask your agent to schedule recurring jobs
            <br />
            like daily digests or weekly reports.
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-y-auto p-ml">
          <div className="mx-auto max-w-[1080px]">
            <section className="mb-3xl">
              <SectionHeader
                title="All cron jobs"
                right={<SortButton value={sort} onChange={setSort} />}
              />
              <MobileListCard>
                {sorted.map((job) => (
                  <MobileCronRow
                    key={job.id}
                    job={job}
                    threads={threads}
                    onClick={() => setSelectedId(job.id)}
                  />
                ))}
              </MobileListCard>
            </section>
          </div>
        </div>
      )}

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
  onRunNow: (job: CronJobRecord) => void | Promise<void>;
  onToggleEnabled: (job: CronJobRecord, next: boolean) => void | Promise<void>;
  onSaveEdits: (job: CronJobRecord, edits: CronJobEdits) => void | Promise<void>;
  onDelete: (job: CronJobRecord) => void | Promise<void>;
  onDuplicate: (job: CronJobRecord) => void;
  onOpenThread: (threadId: string) => void;
}) {
  useBodyScrollLock(true);
  const [menuOpen, setMenuOpen] = useState(false);
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
    <div className="claw-fade-in fixed inset-0 z-[70] flex flex-col bg-background dark:bg-foreground">
      <MobileDetailHeader
        onBack={onClose}
        title={{ label: job.name }}
        actions={
          <HeaderIconButton onClick={() => setMenuOpen(true)} label="Open menu">
            <MoreVertical size={18} />
          </HeaderIconButton>
        }
      />
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
          mobile
        />
      </div>
      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={job.name}
        items={[
          {
            key: "run-now",
            label: "Run now",
            icon: Play,
            onSelect: () => onRunNow(job),
          },
          {
            key: "toggle",
            label: job.enabled ? "Pause job" : "Resume job",
            icon: job.enabled ? Pause : Play,
            onSelect: () => onToggleEnabled(job, !job.enabled),
          },
          {
            key: "delete",
            label: "Delete job",
            icon: Trash2,
            destructive: true,
            onSelect: () => onDelete(job),
          },
        ]}
      />
    </div>
  );
}

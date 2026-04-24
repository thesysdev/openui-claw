"use client";

import type { Thread } from "@openuidev/react-headless";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { Pause, Pencil, Play, Trash2 } from "lucide-react";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SortPills } from "@/components/ui/SortPills";
import { Tag } from "@/components/layout/sidebar/Tag";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import { relTime } from "@/lib/time";

import { CronDetailTray, type CronJobEdits } from "./CronDetailTray";
import { cronOwnerLabel, humanFrequency } from "./format";

type Sort = "recent" | "a-z";

const MIN_TRAY = 320;
const MAX_TRAY = 720;

export interface CronsViewProps {
  cronJobs: CronJobRecord[];
  runs: CronRunEntry[];
  threads: Thread[];
  /** Optional deep-link — when set, the tray opens for this job on mount. */
  initialSelectedId?: string;
  onOpenThread: (threadId: string) => void;
}

export function CronsView({
  cronJobs,
  runs,
  threads,
  initialSelectedId,
  onOpenThread,
}: CronsViewProps) {
  const [sort, setSort] = useState<Sort>("recent");
  /** Local overlay — keyed by job id. Surfaces optimistic edits before a backend round-trip. */
  const [overlay, setOverlay] = useState<Record<string, Partial<CronJobRecord>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [trayWidth, setTrayWidth] = useState(480);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDragStart = useCallback((e: ReactMouseEvent) => {
    dragRef.current = { startX: e.clientX, startWidth: trayWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setTrayWidth(
        Math.min(MAX_TRAY, Math.max(MIN_TRAY, dragRef.current.startWidth + delta)),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [trayWidth]);

  /** Apply local overlay on top of the source record and drop deleted jobs. */
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

  const patch = (id: string, fields: Partial<CronJobRecord>) => {
    setOverlay((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? {}), ...fields, updatedAtMs: Date.now() },
    }));
  };

  const handleRunNow = (job: CronJobRecord) => {
    patch(job.id, { updatedAtMs: Date.now() });
  };

  const handleToggleEnabled = (job: CronJobRecord, nextEnabled: boolean) => {
    patch(job.id, { enabled: nextEnabled });
  };

  const handleSaveEdits = (job: CronJobRecord, edits: CronJobEdits) => {
    const nextSchedule =
      edits.scheduleExpr && edits.scheduleExpr !== job.schedule?.expr
        ? { ...(job.schedule ?? { kind: "cron" }), kind: "cron", expr: edits.scheduleExpr }
        : job.schedule;
    patch(job.id, {
      name: edits.name ?? job.name,
      description: edits.prompt ?? job.description,
      schedule: nextSchedule,
    });
  };

  const handleDelete = (job: CronJobRecord) => {
    setDeletedIds((curr) => new Set([...curr, job.id]));
    setSelectedId(null);
  };

  const handleDuplicate = (job: CronJobRecord) => {
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
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-background">
      {/* ── Main list ── */}
      <div className="min-w-0 flex-1 overflow-y-auto p-3xl">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="mb-3xl font-heading text-lg font-bold text-text-neutral-primary">
            Cron Jobs
          </h2>

          {sorted.length === 0 ? (
            <div className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-border-default px-ml text-center text-sm text-text-neutral-tertiary">
              <p>
                Ask your agent to schedule recurring jobs
                <br />
                like daily digests or weekly reports.
              </p>
            </div>
          ) : (
            <section>
              <SectionHeader
                title="All cron jobs"
                right={
                  <SortPills
                    value={sort}
                    options={[
                      { key: "recent", label: "Recent" },
                      { key: "a-z", label: "A–Z" },
                    ]}
                    onChange={setSort}
                  />
                }
              />
              <div className="overflow-hidden rounded-2xl border border-border-default/50 dark:border-border-default/16">
                <table className="w-full table-fixed">
                  <thead className="bg-sunk-light/60 dark:bg-foreground/60">
                    <tr className="text-left">
                      <Th className="w-[30%]">Name</Th>
                      <Th className="w-[90px]">Status</Th>
                      <Th className="w-[22%]">Schedule</Th>
                      <Th className="w-[22%]">Owner</Th>
                      <Th className="w-[110px]">Last run</Th>
                      <Th className="w-[120px] text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50 dark:divide-border-default/16">
                    {sorted.map((job) => {
                      const isActive = selectedId === job.id;
                      const lastRun = runs
                        .filter((r) => r.jobId === job.id)
                        .sort((a, b) => b.ts - a.ts)[0];
                      return (
                        <tr
                          key={job.id}
                          onClick={() => setSelectedId(job.id)}
                          aria-selected={isActive}
                          className={`group cursor-pointer transition-colors ${
                            isActive
                              ? "bg-sunk-light dark:bg-foreground"
                              : "hover:bg-sunk-light/50 dark:hover:bg-foreground/60"
                          }`}
                        >
                          <Td>
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-xs">
                              <span className="truncate font-body text-sm font-medium text-text-neutral-primary">
                                {job.name}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(job.id);
                                }}
                                className="shrink-0 rounded-m p-2xs text-text-neutral-tertiary opacity-0 transition-opacity hover:bg-sunk-light hover:text-text-neutral-primary group-hover:opacity-100 dark:hover:bg-foreground"
                                title="Edit name"
                                aria-label="Edit name"
                              >
                                <Pencil size={13} />
                              </button>
                            </div>
                          </Td>
                          <Td>
                            <Tag
                              size="lg"
                              variant={job.enabled ? "success" : "neutral"}
                              className="shrink-0"
                            >
                              {job.enabled ? "Active" : "Paused"}
                            </Tag>
                          </Td>
                          <Td>
                            <span className="truncate font-body text-sm text-text-neutral-primary">
                              {humanFrequency(job)}
                            </span>
                          </Td>
                          <Td>
                            <span className="truncate font-body text-sm text-text-neutral-tertiary">
                              {cronOwnerLabel(job, threads) || "—"}
                            </span>
                          </Td>
                          <Td>
                            <span className="truncate font-body text-sm text-text-neutral-tertiary">
                              {lastRun ? relTime(lastRun.ts) : "—"}
                            </span>
                          </Td>
                          <Td className="text-right">
                            <div
                              className="flex items-center justify-end gap-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconButton
                                icon={Play}
                                variant="tertiary"
                                size="sm"
                                title="Run now"
                                aria-label="Run now"
                                onClick={() => handleRunNow(job)}
                              />
                              <IconButton
                                icon={job.enabled ? Pause : Play}
                                variant="tertiary"
                                size="sm"
                                title={job.enabled ? "Pause job" : "Resume job"}
                                aria-label={job.enabled ? "Pause job" : "Resume job"}
                                onClick={() => handleToggleEnabled(job, !job.enabled)}
                              />
                              <IconButton
                                icon={Trash2}
                                variant="tertiary"
                                size="sm"
                                title="Delete job"
                                aria-label="Delete job"
                                onClick={() => handleDelete(job)}
                              />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Detail tray ── */}
      {selected ? (
        <CronDetailTray
          job={selected}
          runs={runs}
          threads={threads}
          width={trayWidth}
          onDragStart={onDragStart}
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

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-ml py-m font-label text-sm font-medium text-text-neutral-secondary ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-ml py-ml align-middle ${className}`}>
      <div className={`flex items-center ${className.includes("text-right") ? "justify-end" : ""}`}>
        {children}
      </div>
    </td>
  );
}


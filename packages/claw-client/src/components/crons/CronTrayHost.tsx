"use client";

import type { Thread } from "@openuidev/react-headless";
import { MoreVertical, Pause, Play, RotateCw, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { CronDetailTray, type CronJobEdits } from "@/components/crons/CronDetailTray";
import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileDetailHeader } from "@/components/mobile/MobileDetailHeader";
import { MobileMenuDrawer } from "@/components/mobile/MobileMenuDrawer";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

const MIN_TRAY = 320;
const MAX_TRAY = 720;

export interface CronTrayHostProps {
  jobId: string;
  cronJobs: CronJobRecord[];
  runs: CronRunEntry[];
  threads: Thread[];
  isMobile: boolean;
  onClose: () => void;
  onOpenThread: (threadId: string) => void;
  onUpdateCronJob?: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  onRunCronJob?: (id: string, mode?: "force" | "due") => Promise<boolean>;
  onRemoveCronJob?: (id: string) => Promise<boolean>;
  onRefreshCronData?: () => Promise<unknown>;
}

/**
 * Renders the cron detail tray as a modal overlay over whatever page the
 * user is on. Owns its own optimistic-overlay state so edits in the tray
 * feel instant before the gateway round-trip lands.
 */
export function CronTrayHost({
  jobId,
  cronJobs,
  runs,
  threads,
  isMobile,
  onClose,
  onOpenThread,
  onUpdateCronJob,
  onRunCronJob,
  onRemoveCronJob,
  onRefreshCronData,
}: CronTrayHostProps) {
  const [overlay, setOverlay] = useState<Record<string, Partial<CronJobRecord>>>({});
  const [trayWidth, setTrayWidth] = useState(480);

  const job = useMemo(() => {
    const base = cronJobs.find((j) => j.id === jobId);
    if (!base) return null;
    return { ...base, ...(overlay[jobId] ?? {}) };
  }, [cronJobs, jobId, overlay]);

  const patch = useCallback((id: string, fields: Partial<CronJobRecord>) => {
    setOverlay((curr) => ({
      ...curr,
      [id]: { ...(curr[id] ?? {}), ...fields, updatedAtMs: Date.now() },
    }));
  }, []);

  const onDragStart = useCallback(
    (e: ReactMouseEvent) => {
      const start = { startX: e.clientX, startWidth: trayWidth };
      const onMove = (ev: MouseEvent) => {
        const delta = start.startX - ev.clientX;
        setTrayWidth(Math.min(MAX_TRAY, Math.max(MIN_TRAY, start.startWidth + delta)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [trayWidth],
  );

  const handleRunNow = useCallback(
    async (j: CronJobRecord) => {
      patch(j.id, { updatedAtMs: Date.now() });
      if (!onRunCronJob) return;
      const ok = await onRunCronJob(j.id, "force");
      if (ok && onRefreshCronData) await onRefreshCronData();
    },
    [patch, onRunCronJob, onRefreshCronData],
  );

  const handleToggleEnabled = useCallback(
    async (j: CronJobRecord, nextEnabled: boolean) => {
      patch(j.id, { enabled: nextEnabled });
      if (!onUpdateCronJob) return;
      const ok = await onUpdateCronJob(j.id, { enabled: nextEnabled });
      if (!ok) {
        patch(j.id, { enabled: !nextEnabled });
        return;
      }
      if (onRefreshCronData) await onRefreshCronData();
    },
    [patch, onUpdateCronJob, onRefreshCronData],
  );

  const handleSaveEdits = useCallback(
    async (j: CronJobRecord, edits: CronJobEdits) => {
      const nextSchedule =
        edits.scheduleExpr && edits.scheduleExpr !== j.schedule?.expr
          ? { ...(j.schedule ?? { kind: "cron" }), kind: "cron", expr: edits.scheduleExpr }
          : j.schedule;
      patch(j.id, {
        name: edits.name ?? j.name,
        description: edits.prompt ?? j.description,
        schedule: nextSchedule,
      });
      if (!onUpdateCronJob) return;
      const serverPatch: Record<string, unknown> = {};
      if (edits.name !== undefined) serverPatch["name"] = edits.name;
      if (edits.prompt !== undefined) {
        serverPatch["payload"] = { ...(j.payload ?? {}), message: edits.prompt };
      }
      if (edits.scheduleExpr && edits.scheduleExpr !== j.schedule?.expr) {
        serverPatch["schedule"] = nextSchedule;
      }
      if (Object.keys(serverPatch).length === 0) return;
      const ok = await onUpdateCronJob(j.id, serverPatch);
      if (ok && onRefreshCronData) await onRefreshCronData();
    },
    [patch, onUpdateCronJob, onRefreshCronData],
  );

  const handleDelete = useCallback(
    async (j: CronJobRecord) => {
      onClose();
      if (!onRemoveCronJob) return;
      await onRemoveCronJob(j.id);
      if (onRefreshCronData) await onRefreshCronData();
    },
    [onClose, onRemoveCronJob, onRefreshCronData],
  );

  if (!job) return null;

  if (isMobile) {
    return (
      <MobileCronTrayShell
        job={job}
        runs={runs}
        threads={threads}
        onClose={onClose}
        onRunNow={handleRunNow}
        onToggleEnabled={handleToggleEnabled}
        onSaveEdits={handleSaveEdits}
        onDelete={handleDelete}
        onOpenThread={onOpenThread}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close cron details"
        className="flex-1 bg-overlay"
        onClick={onClose}
      />
      <CronDetailTray
        job={job}
        runs={runs}
        threads={threads}
        width={trayWidth}
        onDragStart={onDragStart}
        onClose={onClose}
        onRunNow={handleRunNow}
        onToggleEnabled={handleToggleEnabled}
        onSaveEdits={handleSaveEdits}
        onDelete={handleDelete}
        onOpenThread={onOpenThread}
      />
    </div>
  );
}

function MobileCronTrayShell({
  job,
  runs,
  threads,
  onClose,
  onRunNow,
  onToggleEnabled,
  onSaveEdits,
  onDelete,
  onOpenThread,
}: {
  job: CronJobRecord;
  runs: CronRunEntry[];
  threads: Thread[];
  onClose: () => void;
  onRunNow: (j: CronJobRecord) => void | Promise<void>;
  onToggleEnabled: (j: CronJobRecord, next: boolean) => void | Promise<void>;
  onSaveEdits: (j: CronJobRecord, edits: CronJobEdits) => void | Promise<void>;
  onDelete: (j: CronJobRecord) => void | Promise<void>;
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
            icon: RotateCw,
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

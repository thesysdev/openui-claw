"use client";

import {
  ArrowLeft,
  Check,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Thread } from "@openuidev/react-headless";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Tag } from "@/components/layout/sidebar/Tag";
import { TopBar } from "@/components/chat/TopBar";
import type { CronJobRecord, CronRunEntry } from "@/lib/cron";
import { relTime } from "@/lib/time";

import { cronOwnerLabel, humanFrequency } from "./format";

type DetailTab = "details" | "history";

export interface CronJobEdits {
  name?: string;
  scheduleExpr?: string;
  prompt?: string;
  enabled?: boolean;
}

export interface CronDetailTrayProps {
  job: CronJobRecord;
  runs: CronRunEntry[];
  threads: Thread[];
  width: number;
  onDragStart: (e: ReactMouseEvent) => void;
  onClose: () => void;
  onRunNow?: (job: CronJobRecord) => void;
  onToggleEnabled?: (job: CronJobRecord, nextEnabled: boolean) => void;
  onSaveEdits?: (job: CronJobRecord, edits: CronJobEdits) => void;
  onDelete?: (job: CronJobRecord) => void;
  onDuplicate?: (job: CronJobRecord) => void;
  onOpenThread?: (threadId: string) => void;
  /** Mobile full-screen takeover — covers the bottom nav, swaps close X for back arrow. */
  fullScreen?: boolean;
}

export function CronDetailTray({
  job,
  runs,
  threads,
  width,
  onDragStart,
  onClose,
  onRunNow,
  onToggleEnabled,
  onSaveEdits,
  onDelete,
  onDuplicate,
  onOpenThread,
  fullScreen = false,
}: CronDetailTrayProps) {
  const [tab, setTab] = useState<DetailTab>("details");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const jobRuns = useMemo(
    () => runs.filter((r) => r.jobId === job.id).sort((a, b) => b.ts - a.ts),
    [runs, job.id],
  );
  const lastRun = jobRuns[0];
  const ownerLabel = cronOwnerLabel(job, threads);

  const saveField = (fields: CronJobEdits) => {
    onSaveEdits?.(job, fields);
  };

  return (
    <div
      className={`flex h-full flex-col bg-background ${
        fullScreen
          ? "fixed inset-0 z-[70] w-full overflow-y-auto"
          : "relative shrink-0 border-l border-border-default/50 dark:border-border-default/16"
      }`}
      style={
        fullScreen
          ? {
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }
          : { width }
      }
    >
      <TopBar
        leading={
          fullScreen ? (
            <IconButton
              icon={ArrowLeft}
              variant="tertiary"
              size="md"
              title="Back"
              aria-label="Back"
              onClick={onClose}
            />
          ) : undefined
        }
        actions={
          fullScreen ? null : (
            <IconButton
              icon={X}
              variant="tertiary"
              size="md"
              title="Close"
              aria-label="Close cron job"
              onClick={onClose}
            />
          )
        }
      >
        <InlineText
          value={job.name}
          onSave={(next) => saveField({ name: next })}
          className="min-w-0 flex-1 font-heading text-md font-medium text-text-neutral-primary"
        />
      </TopBar>


      {/* ── Tabs ── */}
      <div className="flex gap-ml border-b border-border-default/50 px-ml dark:border-border-default/16">
        {(
          [
            { key: "details", label: "Details" },
            { key: "history", label: `History · ${jobRuns.length}` },
          ] as const
        ).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 py-s font-label text-sm transition-colors ${
                active
                  ? "border-text-neutral-primary font-medium text-text-neutral-primary"
                  : "border-transparent font-regular text-text-neutral-tertiary hover:text-text-neutral-secondary"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-ml py-ml">
        {tab === "details" ? (
          <DetailsPanel
            job={job}
            lastRun={lastRun}
            ownerLabel={ownerLabel}
            confirmDelete={confirmDelete}
            onConfirmDelete={setConfirmDelete}
            onSaveField={saveField}
            onRunNow={() => onRunNow?.(job)}
            onTogglePause={() => onToggleEnabled?.(job, !job.enabled)}
            onDelete={onDelete ? () => onDelete(job) : undefined}
            onOpenThread={onOpenThread}
          />
        ) : (
          <HistoryPanel runs={jobRuns} onOpenThread={onOpenThread} />
        )}
      </div>

      {/* Left-edge resize handle (desktop side panel only) */}
      {fullScreen ? null : (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onDragStart}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-border-default/70"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Details tab — inline-editable fields
// ─────────────────────────────────────────────────────────────────────────────

function DetailsPanel({
  job,
  lastRun,
  ownerLabel,
  confirmDelete,
  onConfirmDelete,
  onSaveField,
  onRunNow,
  onTogglePause,
  onDelete,
  onOpenThread,
}: {
  job: CronJobRecord;
  lastRun: CronRunEntry | undefined;
  ownerLabel: string;
  confirmDelete: boolean;
  onConfirmDelete: (next: boolean) => void;
  onSaveField: (edits: CronJobEdits) => void;
  onRunNow: () => void;
  onTogglePause: () => void;
  onDelete?: () => void;
  onOpenThread?: (threadId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-xl">
      {/* ── Basic details · list card ── */}
      <ListCard>
        <ListRow
          label="Name"
          value={
            <InlineText
              value={job.name}
              onSave={(next) => onSaveField({ name: next })}
              className="font-body text-sm font-medium text-text-neutral-primary"
            />
          }
        />
        <ListRow
          label="Status"
          value={
            <Tag size="lg" variant={job.enabled ? "success" : "neutral"}>
              {job.enabled ? "Active" : "Paused"}
            </Tag>
          }
        />
        <ListRow
          label="Schedule"
          value={
            <span className="font-mono text-sm text-text-neutral-primary">
              {job.schedule?.expr ?? humanFrequency(job)}
            </span>
          }
          hint={`${humanFrequency(job)}${job.schedule?.tz ? ` · ${job.schedule.tz}` : ""}`}
        />
        <ListRow
          label="Last run"
          value={
            lastRun ? (
              <div className="flex items-center gap-xs">
                <StatusDot
                  className={
                    lastRun.status === "failed"
                      ? "bg-text-danger-primary"
                      : lastRun.status === "skipped"
                        ? "bg-text-neutral-tertiary"
                        : "bg-text-success-primary"
                  }
                  size={6}
                />
                <span className="truncate font-body text-sm text-text-neutral-primary">
                  {lastRun.summary ??
                    (lastRun.status === "failed" ? "Failed" : "Completed")}
                </span>
                <span className="shrink-0 font-body text-sm text-text-neutral-tertiary">
                  · {relTime(lastRun.ts)}
                </span>
              </div>
            ) : (
              <span className="font-body text-sm text-text-neutral-tertiary">
                No runs yet
              </span>
            )
          }
        />
        <ListRow
          label="Parent agent"
          value={
            <span className="truncate font-body text-sm text-text-neutral-primary">
              {ownerLabel || "Unowned"}
            </span>
          }
          trailing={
            job.threadId ? (
              <ExternalLink size={13} className="shrink-0 text-text-neutral-tertiary" />
            ) : null
          }
          onClick={job.threadId ? () => onOpenThread?.(job.threadId!) : undefined}
        />
      </ListCard>

      {/* ── Actions · Run now · Pause · Delete ── */}
      <section>
        <h3 className="mb-s font-label text-sm font-medium text-text-neutral-tertiary">
          Actions
        </h3>
        {confirmDelete && onDelete ? (
          <div className="flex items-center justify-between gap-s rounded-m border border-border-default/50 bg-sunk-light/50 px-m py-s dark:border-border-default/16 dark:bg-foreground">
            <span className="font-body text-sm text-text-neutral-secondary">
              Delete this cron job? Runs will stop immediately.
            </span>
            <div className="flex shrink-0 items-center gap-xs">
              <Button
                variant="secondary"
                size="md"
                onClick={() => onConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button variant="secondary" size="md" icon={Trash2} onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-xs">
            <Button variant="secondary" size="md" icon={Play} onClick={onRunNow}>
              Run now
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={job.enabled ? Pause : Play}
              onClick={onTogglePause}
            >
              {job.enabled ? "Pause" : "Resume"}
            </Button>
            {onDelete ? (
              <Button
                variant="secondary"
                size="md"
                icon={Trash2}
                onClick={() => onConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Prompt · editable block ── */}
      <section>
        <h3 className="mb-s font-label text-sm font-medium text-text-neutral-tertiary">
          Prompt
        </h3>
        <InlineTextarea
          value={job.description ?? ""}
          placeholder="Instructions the agent runs each trigger…"
          onSave={(next) => onSaveField({ prompt: next })}
        />
      </section>
    </div>
  );
}

// ─── List card · key/value rows ────────────────────────────────────────────

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-m border border-border-default/50 dark:border-border-default/16">
      <div className="divide-y divide-border-default/50 dark:divide-border-default/16">
        {children}
      </div>
    </div>
  );
}

function ListRow({
  label,
  value,
  hint,
  trailing,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === "function";
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={hint}
      className={`flex items-center gap-m bg-background px-m py-s dark:bg-foreground/60 ${
        interactive
          ? "cursor-pointer transition-colors hover:bg-sunk-light/60 dark:hover:bg-foreground"
          : ""
      }`}
    >
      <span className="w-[110px] shrink-0 font-label text-sm text-text-neutral-tertiary">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{value}</div>
      {trailing}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History tab — filter chips + table
// ─────────────────────────────────────────────────────────────────────────────

function HistoryPanel({
  runs,
  onOpenThread,
}: {
  runs: CronRunEntry[];
  onOpenThread?: (threadId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-m">
      {runs.length === 0 ? (
        <p className="rounded-m border border-dashed border-border-default/70 px-m py-l text-center font-body text-sm text-text-neutral-tertiary dark:border-border-default">
          No runs to show.
        </p>
      ) : (
        <div className="overflow-hidden rounded-m border border-border-default/50 dark:border-border-default/16">
          <table className="w-full table-fixed">
            <thead className="bg-sunk dark:bg-foreground">
              <tr className="text-left">
                <th className="w-[110px] px-m py-s font-label text-sm font-medium text-text-neutral-secondary">
                  When
                </th>
                <th className="px-m py-s font-label text-sm font-medium text-text-neutral-secondary">
                  Summary
                </th>
                <th className="w-[80px] px-m py-s text-right font-label text-sm font-medium text-text-neutral-secondary">
                  Duration
                </th>
                <th className="w-[48px] px-m py-s" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default/50 dark:divide-border-default/16">
              {runs.map((run) => (
                <tr key={`${run.jobId}-${run.ts}`} className="align-top">
                  <td className="px-m py-s">
                    <div className="flex items-center gap-xs">
                      <StatusDot
                        className={
                          run.status === "failed"
                            ? "bg-text-danger-primary"
                            : run.status === "skipped"
                              ? "bg-text-neutral-tertiary"
                              : "bg-text-success-primary"
                        }
                        size={6}
                      />
                      <span className="font-body text-sm text-text-neutral-tertiary">
                        {relTime(run.ts)}
                      </span>
                    </div>
                  </td>
                  <td className="px-m py-s">
                    <p className="font-body text-sm text-text-neutral-primary">
                      {run.summary ??
                        (run.status === "failed" ? "Failed" : "Completed")}
                    </p>
                    {run.error ? (
                      <p className="mt-2xs whitespace-pre-wrap font-mono text-xs text-text-danger-primary">
                        {run.error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-m py-s text-right">
                    <span className="font-body text-sm text-text-neutral-tertiary">
                      {run.durationMs != null
                        ? `${Math.max(1, Math.round(run.durationMs / 100) / 10)}s`
                        : "—"}
                    </span>
                  </td>
                  <td className="px-m py-s">
                    {run.threadId ? (
                      <button
                        type="button"
                        onClick={() => onOpenThread?.(run.threadId!)}
                        className="rounded-m p-2xs text-text-neutral-tertiary hover:bg-sunk-light hover:text-text-neutral-primary dark:hover:bg-foreground"
                        title="Open run thread"
                        aria-label="Open run thread"
                      >
                        <ExternalLink size={12} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label text-sm font-medium text-text-neutral-tertiary">
        {label}
      </span>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-body text-sm text-text-neutral-tertiary">{children}</span>
  );
}

/** Inline-editable single-line field. Shows pencil on hover; click to edit. */
function InlineText({
  value,
  placeholder,
  className = "",
  mono = false,
  onSave,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-xs">
        <input
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={`min-w-0 flex-1 rounded-m border border-border-default bg-background px-s py-2xs outline-none focus:border-border-interactive-emphasis ${
            mono ? "font-mono text-sm" : "font-body text-sm"
          } text-text-neutral-primary`}
        />
        <IconButton
          icon={Check}
          variant="tertiary"
          size="sm"
          title="Save"
          aria-label="Save"
          onClick={commit}
        />
        <IconButton
          icon={X}
          variant="tertiary"
          size="sm"
          title="Cancel"
          aria-label="Cancel"
          onClick={cancel}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`group flex min-w-0 items-center gap-xs rounded-m px-s py-2xs text-left transition-colors hover:bg-sunk-light dark:hover:bg-foreground ${className}`}
    >
      <span className="truncate">
        {value || (
          <span className="text-text-neutral-tertiary">{placeholder ?? "—"}</span>
        )}
      </span>
      <Pencil
        size={12}
        className="shrink-0 text-text-neutral-tertiary opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}

/** Inline-editable multiline field (Prompt). */
function InlineTextarea({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-xs">
        <textarea
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          rows={5}
          className="w-full resize-y rounded-m border border-border-default bg-background px-s py-xs font-body text-sm text-text-neutral-primary outline-none focus:border-border-interactive-emphasis"
        />
        <div className="flex justify-end gap-xs">
          <Button variant="secondary" size="md" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="secondary" size="md" icon={Check} onClick={commit}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group flex w-full flex-col items-start gap-xs rounded-m border border-border-default/50 bg-sunk-light/50 p-m text-left transition-colors hover:border-border-default hover:bg-sunk-light dark:border-border-default/16 dark:bg-foreground dark:hover:bg-popover-background"
    >
      <p className="whitespace-pre-wrap font-body text-sm text-text-neutral-secondary">
        {value.trim() ? (
          value
        ) : (
          <span className="text-text-neutral-tertiary">
            {placeholder ?? "Click to add"}
          </span>
        )}
      </p>
      <span className="inline-flex items-center gap-xs font-label text-sm text-text-neutral-tertiary opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil size={11} /> Edit
      </span>
    </button>
  );
}

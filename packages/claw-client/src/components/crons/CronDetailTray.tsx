"use client";

import type { Thread } from "@openuidev/react-headless";
import { Check, ExternalLink, Pause, Pencil, Play, RotateCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";

import { TopBar } from "@/components/chat/TopBar";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { Tag } from "@/components/layout/sidebar/Tag";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusDot } from "@/components/ui/StatusDot";
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
  onRunNow?: (job: CronJobRecord) => void | Promise<void>;
  onToggleEnabled?: (job: CronJobRecord, nextEnabled: boolean) => void | Promise<void>;
  onSaveEdits?: (job: CronJobRecord, edits: CronJobEdits) => void | Promise<void>;
  onDelete?: (job: CronJobRecord) => void | Promise<void>;
  onDuplicate?: (job: CronJobRecord) => void;
  onOpenThread?: (threadId: string) => void;
  /** Mobile preset — hides inner TopBar, swaps tabs for a segmented control, and uses spacious padding. */
  mobile?: boolean;
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
  onOpenThread,
  mobile,
}: CronDetailTrayProps) {
  const [tab, setTab] = useState<DetailTab>("details");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The tray instance can outlive a single job (the parent uses one tray and
  // swaps `job` when the user picks another row). Reset to "details" whenever
  // the job changes so opening Edit on a new job doesn't land you on the
  // History tab inherited from the previous job.
  useEffect(() => {
    setTab("details");
    setConfirmDelete(false);
  }, [job.id]);

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
      className={`relative flex h-full shrink-0 flex-col border-l border-border-default/50 bg-background dark:border-border-default/16 ${mobile ? "" : "claw-slide-in-right"}`}
      style={{ width }}
    >
      {mobile ? null : (
        <TopBar
          actions={
            <IconButton
              icon={X}
              variant="tertiary"
              size="md"
              title="Close"
              aria-label="Close cron job"
              onClick={onClose}
            />
          }
        >
          <InlineText
            value={job.name}
            onSave={(next) => saveField({ name: next })}
            className="min-w-0 flex-1 font-heading text-md font-medium text-text-neutral-primary"
          />
        </TopBar>
      )}

      {/* ── Tabs ── */}
      <div className="px-ml pb-s pt-s">
        <SegmentedTabs<DetailTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "details", label: "Details" },
            {
              value: "history",
              labelText: `History (${jobRuns.length})`,
              label: (
                <span className="inline-flex items-center gap-xs">
                  History
                  <Counter size="md" color="neutral" kind="secondary">
                    {jobRuns.length}
                  </Counter>
                </span>
              ),
            },
          ]}
          ariaLabel="Cron detail view"
        />
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
            onOpenAgent={() => {
              // Resolve the agent's main thread id (the chat thread the user
              // expects to land in), not the cron's synthetic session key —
              // the latter routes to a non-existent chat URL.
              const agentId = job.agentId;
              if (!agentId) return;
              const main = (
                threads as { id: string; clawAgentId?: string; clawKind?: string }[]
              ).find((t) => (t.clawAgentId ?? t.id) === agentId && t.clawKind === "main");
              if (main) onOpenThread?.(main.id);
            }}
            mobile={mobile}
          />
        ) : (
          <HistoryPanel runs={jobRuns} onOpenThread={onOpenThread} />
        )}
      </div>

      {/* Left-edge resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onDragStart}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-border-default/70"
      />
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
  onOpenAgent,
  mobile,
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
  onOpenAgent?: () => void;
  mobile?: boolean;
}) {
  const actionBtn = mobile ? "h-9 px-m" : "";
  return (
    <div className="flex flex-col gap-xl">
      {/* ── Basic details · list card ── */}
      <ListCard>
        <ListRow
          mobile={mobile}
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
          mobile={mobile}
          label="Status"
          value={
            <Tag size="lg" variant={job.enabled ? "success" : "neutral"}>
              {job.enabled ? "Active" : "Paused"}
            </Tag>
          }
        />
        <ListRow
          mobile={mobile}
          label="Schedule"
          value={
            <span className="font-mono text-sm text-text-neutral-primary">
              {job.schedule?.expr ?? humanFrequency(job)}
            </span>
          }
          hint={`${humanFrequency(job)}${job.schedule?.tz ? ` · ${job.schedule.tz}` : ""}`}
        />
        <ListRow
          mobile={mobile}
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
                <span className="font-body text-sm text-text-neutral-primary">
                  {relTime(lastRun.ts)}
                </span>
                {lastRun.status && lastRun.status !== "ok" ? (
                  <span className="font-body text-sm text-text-neutral-tertiary">
                    · {lastRun.status}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="font-body text-sm text-text-neutral-tertiary">No runs yet</span>
            )
          }
        />
        <ListRow
          mobile={mobile}
          label="Parent agent"
          value={
            <span className="truncate font-body text-sm text-text-neutral-primary">
              {ownerLabel || "Unowned"}
            </span>
          }
          trailing={
            onOpenAgent && job.agentId ? (
              <ExternalLink size={13} className="shrink-0 text-text-neutral-tertiary" />
            ) : null
          }
          onClick={onOpenAgent && job.agentId ? onOpenAgent : undefined}
        />
      </ListCard>

      {/* Actions: Run now / Pause / Delete (kebab covers these on mobile). */}
      {mobile ? null : (
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
                  className={actionBtn}
                  onClick={() => onConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className={actionBtn}
                  icon={Trash2}
                  onClick={onDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-xs">
              <Button
                variant="secondary"
                size="md"
                className={actionBtn}
                icon={RotateCw}
                onClick={onRunNow}
              >
                Run now
              </Button>
              <Button
                variant="secondary"
                size="md"
                className={actionBtn}
                icon={job.enabled ? Pause : Play}
                onClick={onTogglePause}
              >
                {job.enabled ? "Pause" : "Resume"}
              </Button>
              {onDelete ? (
                <Button
                  variant="secondary"
                  size="md"
                  className={actionBtn}
                  icon={Trash2}
                  onClick={() => onConfirmDelete(true)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* ── Prompt · editable block ── */}
      <section>
        <h3 className="mb-s font-label text-sm font-medium text-text-neutral-tertiary">Prompt</h3>
        <InlineTextarea
          value={job.payload?.message ?? job.prompt ?? job.description ?? ""}
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
  mobile,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  mobile?: boolean;
}) {
  const interactive = typeof onClick === "function";
  const padding = mobile ? "px-ml py-m" : "px-m py-s";
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
      className={`flex items-center gap-m bg-background ${padding} dark:bg-foreground/60 ${
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
                      {run.summary ?? (run.status === "failed" ? "Failed" : "Completed")}
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
        {value || <span className="text-text-neutral-tertiary">{placeholder ?? "—"}</span>}
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
          <span className="text-text-neutral-tertiary">{placeholder ?? "Click to add"}</span>
        )}
      </p>
      <span className="inline-flex items-center gap-xs font-label text-sm text-text-neutral-tertiary opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil size={11} /> Edit
      </span>
    </button>
  );
}

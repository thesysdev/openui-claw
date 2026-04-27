"use client";

/**
 * Skills browser — read-only.
 *
 * Lists the gateway's installed skills via the `skills.status` RPC. The
 * gateway is the source of truth (openclaw ships ~50 built-in skills
 * plus anything the user has installed via ClawHub), so we don't keep
 * any local registry — every visit refetches.
 *
 * Intentionally minimal: a full-width list + search. No detail pane,
 * no editor, no clickability. If you want to manage skills, use the
 * openclaw CLI.
 */

import { BookOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { SkillStatusEntry } from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";

interface Props {
  loadSkills: (agentId?: string) => Promise<SkillStatusEntry[]>;
  setEnabled: (skillKey: string, enabled: boolean) => Promise<boolean>;
  /** Optional — when provided, the view re-fires `skills.status` once the
   *  gateway transitions to CONNECTED. Without this the page can land in an
   *  empty "All 0 / Ready 0" state when mounted before the WS handshake
   *  completes (skills.status rejects with "reconnecting", `.status` swallows
   *  the error and returns [], and we never refetch). */
  connectionState?: ConnectionState;
}

type Filter = "all" | "ready" | "needs-setup" | "disabled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "needs-setup", label: "Needs setup" },
  { id: "disabled", label: "Disabled" },
];

function classify(skill: SkillStatusEntry): Exclude<Filter, "all"> {
  if (skill.disabled || skill.blockedByAllowlist) return "disabled";
  if (!skill.eligible) return "needs-setup";
  return "ready";
}

export function SkillsView({ loadSkills, setEnabled, connectionState }: Props) {
  const [skills, setSkills] = useState<SkillStatusEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await loadSkills();
      setSkills(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setRefreshing(false);
    }
  };

  // Optimistic toggle: flip `disabled` locally, fire RPC, refresh authoritative
  // state on completion (regardless of outcome — the refetch will revert the
  // local flip if the RPC failed). Note: we deliberately do NOT touch
  // `eligible` here — that field is server-derived from binary/config checks,
  // mutating it locally would teleport the row across status filters until
  // the refetch lands.
  const handleToggle = async (skill: SkillStatusEntry) => {
    const next = skill.disabled; // currently disabled? → enable. enabled? → disable.
    setPendingKey(skill.skillKey);
    setSkills(
      (prev) =>
        prev?.map((s) => (s.skillKey === skill.skillKey ? { ...s, disabled: !next } : s)) ?? prev,
    );
    await setEnabled(skill.skillKey, next);
    setPendingKey(null);
    void refresh();
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when the gateway becomes connected. Covers the cold-reload race
  // where mount fires before the WS handshake; the empty list a failed call
  // would have produced gets replaced as soon as the engine is ready.
  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) return;
    if (skills && skills.length > 0) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  const counts = useMemo(() => {
    const c = { all: 0, ready: 0, "needs-setup": 0, disabled: 0 } as Record<Filter, number>;
    for (const s of skills ?? []) {
      c.all += 1;
      c[classify(s)] += 1;
    }
    return c;
  }, [skills]);

  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (filter !== "all" && classify(s) !== filter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.skillKey.toLowerCase().includes(q)
      );
    });
  }, [skills, query, filter]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header — sticky, contains all controls */}
      <header className="border-b border-border-default/40 px-3xl py-l dark:border-border-default/16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-m">
          <div className="flex items-end justify-between gap-l">
            <div>
              <h1 className="font-heading text-2xl font-semibold text-text-neutral-primary">
                Skills
              </h1>
              <p className="mt-2xs text-sm text-text-neutral-tertiary">
                Read-only view of skills exposed by your OpenClaw gateway. Manage them with{" "}
                <code className="font-mono text-sm">openclaw skills</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-neutral-secondary transition-colors hover:bg-foreground disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-m">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-neutral-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter skills"
                className="w-full rounded-lg border border-border-default bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-border-default"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = f.id === filter;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
                      active
                        ? "bg-info-background text-text-info-primary"
                        : "bg-foreground text-text-neutral-secondary hover:text-text-neutral-primary"
                    }`}
                  >
                    {f.label}
                    <span
                      className={`rounded-full px-1.5 text-sm ${
                        active
                          ? "bg-background/40 text-text-info-primary"
                          : "text-text-neutral-tertiary"
                      }`}
                    >
                      {counts[f.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3xl py-l">
        <div className="mx-auto w-full max-w-5xl">
          {skills === null && !error ? (
            <EmptyMessage icon>Loading skills…</EmptyMessage>
          ) : error ? (
            <EmptyMessage icon>
              <span className="text-text-alert-primary">Couldn't load skills.</span>
              <br />
              <span className="text-sm text-text-neutral-tertiary">{error}</span>
            </EmptyMessage>
          ) : filtered.length === 0 ? (
            <EmptyMessage icon>No skills match.</EmptyMessage>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default/40 dark:divide-border-default/16">
              {filtered.map((s) => (
                <SkillRow
                  key={s.skillKey}
                  skill={s}
                  busy={pendingKey === s.skillKey}
                  onToggle={() => void handleToggle(s)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  busy,
  onToggle,
}: {
  skill: SkillStatusEntry;
  busy: boolean;
  onToggle: () => void;
}) {
  const status = classify(skill);
  // Skills blocked by allowlist or marked "always" can't be toggled
  // through skills.update — disabling via gateway requires a config
  // change on the server side.
  const toggleDisabled = busy || skill.blockedByAllowlist || skill.always;
  const enabled = !skill.disabled;
  return (
    <li className="flex items-start justify-between gap-l py-m">
      <div className="flex min-w-0 items-start gap-s">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-md">
          {skill.emoji ?? "•"}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-body text-sm font-medium text-text-neutral-primary">
              {skill.name}
            </span>
            {skill.bundled ? (
              <span className="rounded-full bg-foreground px-2 py-0.5 text-sm uppercase tracking-wide text-text-neutral-tertiary">
                bundled
              </span>
            ) : null}
            {skill.always ? (
              <span className="rounded-full bg-info-background px-2 py-0.5 text-sm uppercase tracking-wide text-text-info-primary">
                always
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-text-neutral-tertiary">
            {skill.description || skill.skillKey}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge kind={status} />
        <ToggleSwitch
          enabled={enabled}
          disabled={toggleDisabled}
          onClick={onToggle}
          ariaLabel={`${enabled ? "Disable" : "Enable"} ${skill.name}`}
        />
      </div>
    </li>
  );
}

function ToggleSwitch({
  enabled,
  disabled,
  onClick,
  ariaLabel,
}: {
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        enabled ? "bg-text-info-primary" : "bg-foreground"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function StatusBadge({ kind }: { kind: Exclude<Filter, "all"> }) {
  const map: Record<Exclude<Filter, "all">, { label: string; classes: string }> = {
    ready: {
      label: "Ready",
      classes: "bg-success-background text-text-success-primary",
    },
    "needs-setup": {
      label: "Needs setup",
      classes: "bg-alert-background text-text-alert-primary",
    },
    disabled: {
      label: "Disabled",
      classes: "bg-foreground text-text-neutral-tertiary",
    },
  };
  const { label, classes } = map[kind];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium ${classes}`}>
      {label}
    </span>
  );
}

function EmptyMessage({ children }: { icon?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-3xl text-center">
      <span className="mb-ml flex h-10 w-10 items-center justify-center rounded-full bg-info-background text-text-info-primary">
        <BookOpen className="h-5 w-5" />
      </span>
      <div className="text-sm text-text-neutral-secondary">{children}</div>
    </div>
  );
}

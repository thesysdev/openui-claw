"use client";

import type { Command } from "@/lib/commands";
import { listCommands } from "@/lib/commands";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { ClawThreadListItem } from "@/types/gateway-responses";
import { Command as CommandPrimitive } from "cmdk";
import Fuse from "fuse.js";
import {
  Clock,
  FileText,
  LayoutGrid,
  MessageSquare,
  Search,
  Terminal,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

export type PaletteTarget =
  | { kind: "thread"; threadId: string; title: string }
  | { kind: "app"; appId: string; title: string }
  | { kind: "artifact"; artifactId: string; title: string }
  | { kind: "command"; command: Command };

type PaletteRow = {
  id: string;
  target: PaletteTarget;
  group: "Commands" | "Threads" | "Apps" | "Artifacts";
  label: string;
  hint: string;
  searchValue: string;
};

const RECENTS_KEY = "claw:cmdk:recents";
const RECENTS_LIMIT = 8;
const FREQUENCY_KEY = "claw:cmdk:freq";
const MAX_FREQUENCY_BOOST = 0.25;

type RecentEntry = { id: string; ts: number };
type FrequencyMap = Record<string, number>;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota errors swallowed; recents are best-effort
  }
}

function rowId(target: PaletteTarget): string {
  switch (target.kind) {
    case "thread":
      return `thread:${target.threadId}`;
    case "app":
      return `app:${target.appId}`;
    case "artifact":
      return `artifact:${target.artifactId}`;
    case "command":
      return `command:${target.command.name}`;
  }
}

function buildRows(params: {
  threads: ClawThreadListItem[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
}): PaletteRow[] {
  const rows: PaletteRow[] = [];
  for (const cmd of listCommands()) {
    const target: PaletteTarget = { kind: "command", command: cmd };
    rows.push({
      id: rowId(target),
      target,
      group: "Commands",
      label: `/${cmd.name}`,
      hint: cmd.description,
      searchValue: `/${cmd.name} ${cmd.description} ${(cmd.aliases ?? []).join(" ")}`,
    });
  }
  for (const thread of params.threads) {
    const target: PaletteTarget = {
      kind: "thread",
      threadId: thread.id,
      title: thread.title,
    };
    rows.push({
      id: rowId(target),
      target,
      group: "Threads",
      label: thread.title || "Untitled thread",
      hint: "Thread",
      searchValue: thread.title ?? "",
    });
  }
  for (const app of params.apps) {
    const target: PaletteTarget = {
      kind: "app",
      appId: app.id,
      title: app.title,
    };
    rows.push({
      id: rowId(target),
      target,
      group: "Apps",
      label: app.title || "Untitled app",
      hint: "App",
      searchValue: app.title ?? "",
    });
  }
  for (const artifact of params.artifacts) {
    const target: PaletteTarget = {
      kind: "artifact",
      artifactId: artifact.id,
      title: artifact.title,
    };
    const kindLabel = artifact.kind
      ? `${artifact.kind[0]?.toUpperCase()}${artifact.kind.slice(1)} artifact`
      : "Artifact";
    rows.push({
      id: rowId(target),
      target,
      group: "Artifacts",
      label: artifact.title || "Untitled artifact",
      hint: kindLabel,
      searchValue: `${artifact.title ?? ""} ${artifact.kind ?? ""}`,
    });
  }
  return rows;
}

function iconFor(target: PaletteTarget) {
  switch (target.kind) {
    case "thread":
      return MessageSquare;
    case "app":
      return LayoutGrid;
    case "artifact":
      return FileText;
    case "command":
      return Terminal;
  }
}

function ResultRow({
  row,
  onSelect,
}: {
  row: PaletteRow;
  onSelect: (target: PaletteTarget) => void;
}) {
  const Icon = iconFor(row.target);
  return (
    <CommandPrimitive.Item
      value={row.id}
      keywords={[row.label, row.hint, row.searchValue]}
      onSelect={() => onSelect(row.target)}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-neutral-primary aria-selected:bg-info-background data-[selected=true]:bg-info-background"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-text-neutral-secondary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-text-neutral-primary">{row.label}</span>
        <span className="truncate text-sm text-text-neutral-tertiary">
          {row.hint}
        </span>
      </span>
    </CommandPrimitive.Item>
  );
}

export function CommandPalette({
  open,
  onClose,
  threads,
  apps,
  artifacts,
  onTarget,
}: {
  open: boolean;
  onClose: () => void;
  threads: ClawThreadListItem[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  onTarget: (target: PaletteTarget) => void;
}) {
  const isMobile = useIsMobile();
  useBodyScrollLock(open && isMobile);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    setRecents(readJSON<RecentEntry[]>(RECENTS_KEY, []));
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const rows = useMemo(
    () => buildRows({ threads, apps, artifacts }),
    [apps, artifacts, threads],
  );

  const rowsById = useMemo(() => {
    const map = new Map<string, PaletteRow>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }, [rows]);

  const fuse = useMemo(
    () =>
      new Fuse(rows, {
        keys: [
          { name: "label", weight: 0.7 },
          { name: "searchValue", weight: 0.3 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 1,
      }),
    [rows],
  );

  const recentRows = useMemo(() => {
    if (deferredQuery.trim()) return [];
    return recents
      .map((entry) => rowsById.get(entry.id))
      .filter((row): row is PaletteRow => Boolean(row))
      .slice(0, RECENTS_LIMIT);
  }, [deferredQuery, recents, rowsById]);

  const ranked = useMemo(() => {
    const q = deferredQuery.trim();
    if (!q) {
      const recentIds = new Set(recentRows.map((r) => r.id));
      return rows.filter((row) => !recentIds.has(row.id));
    }
    const freq = readJSON<FrequencyMap>(FREQUENCY_KEY, {});
    const totalPicks = Object.values(freq).reduce((sum, n) => sum + n, 0);
    const hits = fuse.search(q);
    const scored = hits.map((hit) => {
      const baseScore = hit.score ?? 1;
      const picks = freq[hit.item.id] ?? 0;
      const boost =
        totalPicks > 0
          ? Math.min(MAX_FREQUENCY_BOOST, (picks / totalPicks) * 0.5)
          : 0;
      return { row: hit.item, score: baseScore - boost };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 60).map((entry) => entry.row);
  }, [deferredQuery, fuse, recentRows, rows]);

  const grouped = useMemo(() => {
    const buckets: Record<PaletteRow["group"], PaletteRow[]> = {
      Commands: [],
      Threads: [],
      Apps: [],
      Artifacts: [],
    };
    for (const row of ranked) buckets[row.group].push(row);
    return buckets;
  }, [ranked]);

  const handleSelect = (target: PaletteTarget) => {
    const id = rowId(target);
    const nextRecents = [
      { id, ts: Date.now() },
      ...recents.filter((entry) => entry.id !== id),
    ].slice(0, RECENTS_LIMIT * 2);
    writeJSON(RECENTS_KEY, nextRecents);
    const freq = readJSON<FrequencyMap>(FREQUENCY_KEY, {});
    freq[id] = (freq[id] ?? 0) + 1;
    writeJSON(FREQUENCY_KEY, freq);
    onTarget(target);
    onClose();
  };

  if (!open) return null;

  const showRecents = recentRows.length > 0 && !deferredQuery.trim();
  const hasAnyResults =
    showRecents ||
    grouped.Commands.length > 0 ||
    grouped.Threads.length > 0 ||
    grouped.Apps.length > 0 ||
    grouped.Artifacts.length > 0;

  const containerClass = isMobile
    ? "fixed inset-0 z-[90] flex flex-col bg-background"
    : "fixed inset-0 z-[90] flex items-start justify-center bg-overlay p-4 backdrop-blur-sm";

  const panelClass = isMobile
    ? "flex h-full w-full flex-col bg-background"
    : "mt-[12vh] flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border-default bg-background shadow-xl";

  return (
    <div
      className={containerClass}
      onClick={isMobile ? undefined : onClose}
      role="presentation"
    >
      <div
        className={panelClass}
        onClick={(event) => event.stopPropagation()}
        style={
          isMobile
            ? { paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }
            : undefined
        }
      >
        <CommandPrimitive
          label="Command palette"
          shouldFilter={false}
          loop
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border-default px-4 py-3">
            <Search size={16} className="text-text-neutral-tertiary" />
            <CommandPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search threads, apps, artifacts, commands…"
              className="w-full bg-transparent text-sm text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
          </div>
          <CommandPrimitive.List
            className={
              isMobile
                ? "flex-1 overflow-y-auto px-2 py-2"
                : "max-h-[50vh] overflow-y-auto px-2 py-2"
            }
          >
            {!hasAnyResults ? (
              <CommandPrimitive.Empty className="px-4 py-8 text-center text-sm text-text-neutral-tertiary">
                No matches
              </CommandPrimitive.Empty>
            ) : null}

            {showRecents ? (
              <CommandPrimitive.Group
                heading={
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} /> Recent
                  </span>
                }
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-neutral-tertiary"
              >
                {recentRows.map((row) => (
                  <ResultRow key={row.id} row={row} onSelect={handleSelect} />
                ))}
              </CommandPrimitive.Group>
            ) : null}

            {(["Commands", "Threads", "Apps", "Artifacts"] as const).map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <CommandPrimitive.Group
                  key={group}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-neutral-tertiary"
                >
                  {items.map((row) => (
                    <ResultRow key={row.id} row={row} onSelect={handleSelect} />
                  ))}
                </CommandPrimitive.Group>
              );
            })}
          </CommandPrimitive.List>
          <div className="flex shrink-0 items-center gap-4 border-t border-border-default bg-sunk-light px-4 py-2 text-sm text-text-neutral-tertiary">
            <span>↑/↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        </CommandPrimitive>
      </div>
    </div>
  );
}

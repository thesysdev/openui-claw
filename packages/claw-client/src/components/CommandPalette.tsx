"use client";

import type { Command } from "@/lib/commands";
import { listCommands } from "@/lib/commands";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { ClawThreadListItem } from "@/types/gateway-responses";
import { FileText, Hash, LayoutGrid, MessageSquare, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteTarget =
  | { kind: "thread"; threadId: string; title: string }
  | { kind: "app"; appId: string; title: string }
  | { kind: "artifact"; artifactId: string; title: string }
  | { kind: "command"; command: Command };

type PaletteRow = {
  target: PaletteTarget;
  label: string;
  hint: string;
};

function collectRows(params: {
  threads: ClawThreadListItem[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
}): PaletteRow[] {
  const rows: PaletteRow[] = [];
  for (const cmd of listCommands()) {
    rows.push({
      target: { kind: "command", command: cmd },
      label: `/${cmd.name}`,
      hint: cmd.description,
    });
  }
  for (const thread of params.threads) {
    rows.push({
      target: { kind: "thread", threadId: thread.id, title: thread.title },
      label: thread.title,
      hint: "Thread",
    });
  }
  for (const app of params.apps) {
    rows.push({
      target: { kind: "app", appId: app.id, title: app.title },
      label: app.title,
      hint: "App",
    });
  }
  for (const artifact of params.artifacts) {
    rows.push({
      target: {
        kind: "artifact",
        artifactId: artifact.id,
        title: artifact.title,
      },
      label: artifact.title,
      hint: `${artifact.kind[0]?.toUpperCase()}${artifact.kind.slice(1)} artifact`,
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
    default:
      return Hash;
  }
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
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => collectRows({ threads, apps, artifacts }), [apps, artifacts, threads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, 40);
    return rows
      .filter((row) => row.label.toLowerCase().includes(q) || row.hint.toLowerCase().includes(q))
      .slice(0, 40);
  }, [query, rows]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [activeIndex, filtered.length]);

  if (!open) return null;

  const choose = (row: PaletteRow) => {
    onTarget(row.target);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-overlay p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-[12vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border-default bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border-default px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads, apps, artifacts, commands…"
            className="w-full bg-transparent text-sm text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((idx) => Math.min(filtered.length - 1, idx + 1));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((idx) => Math.max(0, idx - 1));
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const row = filtered[activeIndex];
                if (row) choose(row);
                return;
              }
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-neutral-tertiary">
              No matches
            </div>
          ) : (
            filtered.map((row, index) => {
              const Icon = iconFor(row.target);
              return (
                <button
                  key={`${row.target.kind}:${row.label}:${index}`}
                  type="button"
                  onClick={() => choose(row)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-start gap-3 px-4 py-2 text-left text-sm transition-colors ${
                    index === activeIndex
                      ? "bg-info-background"
                      : "hover:bg-sunk-light"
                  }`}
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
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border-default bg-sunk-light px-4 py-2 text-sm text-text-neutral-tertiary">
          <span>↑/↓ navigate</span>
          <span className="ml-4">↵ open</span>
          <span className="ml-4">esc close</span>
        </div>
      </div>
    </div>
  );
}

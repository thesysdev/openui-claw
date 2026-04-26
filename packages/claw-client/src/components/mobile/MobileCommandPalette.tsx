"use client";

import { FileText, Hash, LayoutGrid, MessageSquare, Search, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { CATEGORY_STYLES, type TileCategory } from "@/components/layout/sidebar/Tile";
import type { Command } from "@/lib/commands";
import { listCommands } from "@/lib/commands";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import type { ClawThreadListItem } from "@/types/gateway-responses";

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

function SearchTile({
  icon: Icon,
  category,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  category: TileCategory | null;
}) {
  if (category) {
    const c = CATEGORY_STYLES[category];
    return (
      <div
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m ${c.bg}`}
      >
        <Icon size={14} className={c.icon} />
      </div>
    );
  }
  return (
    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m bg-sunk-light dark:bg-elevated-light">
      <Icon size={14} className="text-text-neutral-tertiary" />
    </div>
  );
}

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
      target: { kind: "artifact", artifactId: artifact.id, title: artifact.title },
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

function categoryFor(target: PaletteTarget): TileCategory | null {
  switch (target.kind) {
    case "thread":
      return "agents";
    case "app":
      return "apps";
    case "artifact":
      return "artifacts";
    default:
      return null;
  }
}

export function MobileCommandPalette({
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
  useBodyScrollLock(open);
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = filtered[activeIndex];
      if (row) choose(row);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      <header
        className="flex shrink-0 items-center justify-between gap-s bg-background px-ml py-m"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-heading text-md font-bold text-text-neutral-primary">Search</h2>
        <HeaderIconButton onClick={onClose} label="Close search">
          <X size={18} />
        </HeaderIconButton>
      </header>
      <div className="shrink-0 px-ml pb-m pt-m">
        <div className="flex h-11 items-center gap-s rounded-lg border border-border-default/70 bg-background px-m shadow-sm focus-within:ring-2 focus-within:ring-border-default dark:border-border-default/16 dark:bg-foreground">
          <Search size={16} className="shrink-0 text-text-neutral-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Threads, apps, artifacts, commands…"
            className="min-w-0 flex-1 bg-transparent font-body text-sm text-text-neutral-primary outline-none placeholder:text-text-neutral-tertiary"
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
      <div
        className="flex-1 overflow-y-auto px-ml pb-ml"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {filtered.length === 0 ? (
          <div className="px-ml py-2xl text-center text-sm text-text-neutral-tertiary">
            No matches
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border-default/50 bg-popover-background shadow-xl divide-y divide-border-default/50 dark:divide-border-default/16 dark:border-transparent dark:bg-foreground">
            {filtered.map((row, index) => {
              const Icon = iconFor(row.target);
              const category = categoryFor(row.target);
              return (
                <button
                  key={`${row.target.kind}:${row.label}:${index}`}
                  type="button"
                  onClick={() => choose(row)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className="group flex w-full items-center gap-m px-ml py-m text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light"
                >
                  <SearchTile icon={Icon} category={category} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-body text-sm font-medium text-text-neutral-primary">
                      {row.label}
                    </span>
                    <span className="truncate font-body text-sm text-text-neutral-tertiary">
                      {row.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

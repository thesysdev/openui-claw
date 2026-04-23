"use client";

import { useEffect, useRef, useState } from "react";

export interface TitleSwitcherItem {
  id: string;
  label: string;
  /** Optional right-aligned secondary text (e.g. parent agent name). */
  trailingText?: string;
  /** Optional leading node — e.g. a TextTile. */
  leading?: React.ReactNode;
}

export interface TitleSwitcherProps {
  /** Currently-selected item id. */
  activeId: string;
  /** Displayed label in the trigger (usually the active item's label). */
  currentLabel: string;
  /** All available items (includes the active one). */
  items: TitleSwitcherItem[];
  /** Called when a different item is picked. */
  onSelect: (id: string) => void;
}

/**
 * Clickable title that opens a dropdown of peer items (e.g. other apps or
 * other artifacts available in the current session).
 *
 * Each dropdown row shows the item label on the left and optional tertiary
 * text (like parent agent name) on the right — matches the pattern of the
 * AgentSwitcher in AgentTopBar.
 */
export function TitleSwitcher({
  activeId,
  currentLabel,
  items,
  onSelect,
}: TitleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-xs rounded-m px-2xs transition-colors ${
          open
            ? "bg-sunk-light dark:bg-highlight-subtle"
            : "bg-transparent hover:bg-sunk-light dark:hover:bg-highlight-subtle"
        }`}
      >
        <span className="font-label text-md font-medium text-text-neutral-primary">
          {currentLabel}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-80 w-[320px] overflow-y-auto rounded-lg border border-border-default bg-popover-background p-3xs shadow-xl dark:bg-elevated">
          {items.map((it) => {
            const isActive = it.id === activeId;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onSelect(it.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors ${
                  isActive
                    ? "bg-sunk-light dark:bg-highlight-subtle"
                    : "hover:bg-sunk-light dark:hover:bg-highlight-subtle"
                }`}
              >
                {it.leading ? (
                  <span className="shrink-0">{it.leading}</span>
                ) : null}
                <span
                  className={`min-w-0 flex-1 truncate font-body text-sm ${
                    isActive
                      ? "font-medium text-text-neutral-primary"
                      : "text-text-neutral-secondary"
                  }`}
                >
                  {it.label}
                </span>
                {it.trailingText ? (
                  <span className="shrink-0 truncate font-body text-sm text-text-neutral-tertiary">
                    {it.trailingText}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

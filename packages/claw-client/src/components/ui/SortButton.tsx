"use client";

import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";

import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export type SortValue = "recent" | "a-z";

const OPTIONS: ReadonlyArray<{ value: SortValue; label: string; description: string }> = [
  { value: "recent", label: "Recent", description: "Most recently updated first" },
  { value: "a-z", label: "A–Z", description: "Alphabetical" },
];

interface Props {
  value: SortValue;
  onChange: (next: SortValue) => void;
}

/**
 * Compact text trigger ("Recent ⌄") that opens a bottom-sheet tray with
 * the available sort options. Replaces the prior icon-only sort toggle —
 * gives the user explicit feedback about the current sort + the list of
 * choices.
 */
export function SortButton({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 shrink-0 items-center gap-2xs rounded-md border border-border-default/70 bg-background px-s font-label text-sm font-medium text-text-neutral-secondary shadow-sm transition-colors active:bg-sunk-light active:text-text-neutral-primary dark:border-border-default/16 dark:bg-foreground sm:hover:bg-sunk-light dark:sm:hover:bg-elevated"
      >
        {current.label}
        <ChevronDown size={12} />
      </button>
      <SortTray
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </>
  );
}

function SortTray({
  open,
  value,
  onClose,
  onSelect,
}: {
  open: boolean;
  value: SortValue;
  onClose: () => void;
  onSelect: (next: SortValue) => void;
}) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close sort options"
        className="flex-1 bg-overlay backdrop-blur-[2px]"
      />
      <div
        role="menu"
        className="rounded-t-2xl border-t border-border-default/50 bg-background shadow-2xl dark:border-border-default/16 dark:bg-foreground"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-s mt-s h-[3px] w-10 rounded-full bg-border-default/60 dark:bg-border-default/30" />
        <h3 className="px-ml pb-s text-sm font-medium text-text-neutral-secondary">
          Sort by
        </h3>
        <ul className="px-2xs">
          {OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => onSelect(opt.value)}
                  className={`flex w-full items-center gap-m rounded-lg px-m py-s text-left transition-colors ${
                    active
                      ? "bg-sunk-light text-text-neutral-primary dark:bg-elevated"
                      : "text-text-neutral-secondary active:bg-sunk-light dark:active:bg-elevated sm:hover:bg-sunk-light dark:sm:hover:bg-elevated"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-sm font-medium">{opt.label}</p>
                    <p className="font-body text-sm text-text-neutral-tertiary">
                      {opt.description}
                    </p>
                  </div>
                  {active ? (
                    <Check size={18} className="shrink-0 text-text-neutral-primary" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

/**
 * Filled-outlined header icon button. Visual size 36×36 with extended invisible
 * hit area (`before:inset-[-4px]`) to keep ≥44px tap target. Shared between the
 * mobile shell header and any sheet headers (Settings, Notifications, Workspace)
 * so dismiss/back affordances are visually consistent.
 */
export function HeaderIconButton({
  onClick,
  label,
  badge = false,
  children,
}: {
  onClick: () => void;
  label: string;
  badge?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-default/70 bg-background text-text-neutral-secondary shadow-sm transition-colors active:bg-sunk-light active:text-text-neutral-primary dark:border-border-default/16 dark:bg-foreground sm:hover:bg-sunk-light dark:sm:hover:bg-elevated"
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-text-info-primary ring-2 ring-background dark:ring-foreground" />
      ) : null}
    </button>
  );
}

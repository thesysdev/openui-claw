"use client";

import type { ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  count?: number;
  onShowAll?: () => void;
  right?: ReactNode;
}

/** Title (bold) + optional count + optional "Show all" action. */
export function SectionHeader({ title, count, onShowAll, right }: SectionHeaderProps) {
  return (
    <div className="mb-m flex items-baseline justify-between">
      <span className="font-heading text-md font-bold text-text-neutral-primary">
        {title}
        {count != null && (
          <span className="font-regular text-text-neutral-tertiary"> ({count})</span>
        )}
      </span>
      {right ??
        (onShowAll ? (
          <button
            type="button"
            onClick={onShowAll}
            className="font-label text-sm text-text-neutral-secondary hover:text-text-neutral-primary transition-colors"
          >
            Show all
          </button>
        ) : null)}
    </div>
  );
}

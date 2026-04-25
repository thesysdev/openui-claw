"use client";

import type { ComponentType } from "react";

export interface SegmentedTabOption<V extends string = string> {
  value: V;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface SegmentedTabsProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<SegmentedTabOption<V>>;
  ariaLabel?: string;
}

/**
 * Segmented pill tabs. Active option gets a filled fill (no underline);
 * inactive options stay transparent within a sunken container. Used for
 * Light/Dark, Automated/Manual, and any other binary/short tab groups.
 */
export function SegmentedTabs<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedTabsProps<V>) {
  return (
    <div
      className="grid w-full overflow-hidden rounded-lg bg-sunk-light p-[2px] dark:bg-foreground"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map(({ value: optValue, label, icon: Icon }) => {
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(optValue)}
            className={`flex h-7 items-center justify-center gap-1.5 rounded-md text-sm transition-colors ${
              active
                ? "bg-background font-medium text-text-neutral-primary shadow-sm dark:bg-elevated"
                : "text-text-neutral-secondary active:text-text-neutral-primary sm:hover:text-text-neutral-primary"
            }`}
          >
            {Icon ? <Icon size={14} /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

export type TagSize = "sm" | "md" | "lg";
export type TagVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

// Tags sit outside the app's 12/14/20 body-type scale — they're metadata
// chips, not running text. Using arbitrary 8/10/12 px sizes here by design.
const SIZE_STYLES: Record<TagSize, string> = {
  sm: "px-3xs py-3xs text-[8px] leading-none tracking-[0.04em]",
  md: "px-2xs py-3xs text-[10px] leading-none",
  lg: "h-l px-xs text-sm",
};

const VARIANT_STYLES: Record<TagVariant, string> = {
  neutral:
    "bg-sunk-light text-text-neutral-tertiary dark:text-text-neutral-tertiary/80 border border-border-default/70 dark:border-transparent",
  accent:
    "bg-highlight-subtle text-text-accent-primary border border-border-accent",
  success:
    "bg-success-background text-text-success-primary border border-border-success",
  warning:
    "bg-alert-background text-text-alert-primary border border-border-alert",
  danger:
    "bg-danger-background text-text-danger-primary border border-border-danger",
  info:
    "bg-info-background text-text-info-primary border border-border-info",
};

export interface TagProps {
  size?: TagSize;
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}

/** Compact inline tag / chip for status, shortcut, and metadata labels. */
export function Tag({
  size = "md",
  variant = "neutral",
  children,
  className = "",
}: TagProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-s font-medium leading-none ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

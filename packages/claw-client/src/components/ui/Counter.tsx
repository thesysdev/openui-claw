"use client";

import type { ReactNode } from "react";

export type CounterSize = "sm" | "md" | "lg";
export type CounterColor = "red" | "accent" | "neutral";
export type CounterKind = "primary" | "subtle" | "secondary";

const SIZE_STYLES: Record<CounterSize, string> = {
  sm: "h-[12px] min-w-[12px] px-3xs text-[8px]",
  md: "h-[14px] min-w-[14px] px-3xs text-[8px]",
  lg: "h-5 min-w-5 px-2xs text-sm",
};

/** `secondary` is color-independent — always renders as a muted gray chip. */
const SECONDARY_STYLE =
  "bg-sunk-light dark:bg-highlight-subtle text-text-neutral-tertiary";

const COLOR_PRIMARY_SUBTLE_STYLES: Record<
  CounterColor,
  { primary: string; subtle: string }
> = {
  red: {
    primary: "bg-text-danger-primary text-text-white",
    subtle: "bg-danger-background text-text-danger-primary",
  },
  accent: {
    primary: "bg-interactive-accent text-text-white",
    subtle: "bg-highlight-subtle text-text-accent-primary",
  },
  neutral: {
    primary: "bg-text-neutral-primary text-background",
    subtle: "bg-sunk-light text-text-neutral-tertiary",
  },
};

export interface CounterProps {
  size?: CounterSize;
  color?: CounterColor;
  kind?: CounterKind;
  children: ReactNode;
  className?: string;
}

/**
 * Small numeric badge (unread count, section count, etc.).
 * Three sizes × three colors × two kinds:
 *   - primary — solid filled fill
 *   - subtle  — tinted background with matching text color
 */
export function Counter({
  size = "md",
  color = "red",
  kind = "primary",
  children,
  className = "",
}: CounterProps) {
  const paletteCls =
    kind === "secondary"
      ? SECONDARY_STYLE
      : COLOR_PRIMARY_SUBTLE_STYLES[color][kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-label font-bold leading-none ${SIZE_STYLES[size]} ${paletteCls} ${className}`}
    >
      {children}
    </span>
  );
}

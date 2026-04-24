"use client";

import { useState } from "react";

export interface ContextBreakdownItem {
  label: string;
  tokens: number;
  color?: string;
}

export interface ContextRingProps {
  /** Tokens currently occupied (input + system + tools + files + reserved). */
  used: number;
  /** Total context window of the active model. */
  limit: number;
  /** Optional per-category breakdown (not shown — kept for API compatibility). */
  breakdown?: ContextBreakdownItem[];
  /** Ring diameter in px. Default 12. */
  size?: number;
  className?: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ringColor(pct: number): string {
  if (pct >= 0.85) return "stroke-text-danger-primary";
  if (pct >= 0.6) return "stroke-text-alert-primary";
  return "stroke-text-success-primary";
}

/**
 * Compact circular progress ring showing % of the model's context window
 * used. Hover opens a popover with a per-category token breakdown.
 */
export function ContextRing({
  used,
  limit,
  size = 12,
  className = "",
}: ContextRingProps) {
  const [hover, setHover] = useState(false);
  const pct = limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0;

  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
        aria-label={`Context ${formatTokens(used)} of ${formatTokens(limit)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border-default/70 dark:stroke-border-default"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset,stroke] duration-300 ${ringColor(pct)}`}
        />
      </svg>

      {hover ? (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-xs w-[220px] -translate-x-1/2 rounded-m border border-border-default/70 bg-popover-background p-m shadow-float dark:border-border-default dark:bg-elevated"
        >
          <p className="mb-s font-body text-sm text-text-neutral-primary">
            Context{" "}
            <span className="font-mono text-text-neutral-secondary">
              {formatTokens(used)}
            </span>{" "}
            of{" "}
            <span className="font-mono text-text-neutral-secondary">
              {formatTokens(limit)}
            </span>{" "}
            consumed
          </p>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-border-default/50 dark:bg-border-default/40">
            <div
              className={`h-full ${
                pct >= 0.85
                  ? "bg-text-danger-primary"
                  : pct >= 0.6
                    ? "bg-text-alert-primary"
                    : "bg-text-success-primary"
              } transition-[width] duration-300`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      ) : null}
    </span>
  );
}

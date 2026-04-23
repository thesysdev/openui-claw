"use client";

export interface StatusDotProps {
  /** Tailwind bg-* class (e.g. `bg-status-online`, `bg-text-danger-primary`). */
  className?: string;
  /** Size in pixels — defaults to 6. */
  size?: number;
}

/** Small colored circle used for unread indicators, agent status, etc. */
export function StatusDot({ className = "bg-status-online", size = 6 }: StatusDotProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

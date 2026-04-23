"use client";

export interface SepProps {
  /** Horizontal inset (Tailwind class). */
  className?: string;
}

/** Thin horizontal separator at 35% opacity of border-default. */
export function Sep({ className = "" }: SepProps) {
  return <div className={`h-px w-full bg-border-default/35 ${className}`} />;
}

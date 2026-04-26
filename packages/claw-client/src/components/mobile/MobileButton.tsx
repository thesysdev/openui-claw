"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type MobileButtonVariant = "primary" | "secondary";

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MobileButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

// Match HeaderIconButton: h-9 rounded-lg border border-border-default/70 bg-background shadow-sm
const BASE =
  "inline-flex h-9 shrink-0 items-center justify-center gap-xs rounded-lg px-m font-label text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT: Record<MobileButtonVariant, string> = {
  primary: "bg-inverted-background text-background active:opacity-90",
  secondary:
    "border border-border-default/70 bg-background text-text-neutral-secondary active:bg-sunk-light active:text-text-neutral-primary dark:border-border-default/16 dark:bg-foreground",
};

export function MobileButton({
  variant = "secondary",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: MobileButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`${BASE} ${VARIANT[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

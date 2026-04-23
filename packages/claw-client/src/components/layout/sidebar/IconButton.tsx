"use client";

import type { ComponentType, MouseEventHandler, ReactNode } from "react";

export type IconButtonSize = "sm" | "md" | "lg" | "xl";
export type IconButtonVariant = "primary" | "secondary" | "tertiary" | "inverted" | "pill";

const SIZE_STYLES: Record<IconButtonSize, { box: string; icon: number }> = {
  sm: { box: "h-l w-l", icon: 12 },
  md: { box: "h-7 w-7", icon: 14 },
  lg: { box: "h-2xl w-2xl", icon: 16 },
  xl: { box: "h-10 w-10", icon: 18 },
};

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
  primary:
    "bg-interactive-accent text-background border border-transparent shadow-sm hover:bg-interactive-accent-hover",
  secondary:
    "bg-background text-text-neutral-secondary border border-border-default shadow-sm hover:bg-sunk-light hover:text-text-neutral-primary",
  tertiary:
    "bg-transparent text-text-neutral-tertiary border border-transparent hover:bg-sunk dark:hover:bg-sunk-light hover:text-text-neutral-primary",
  inverted:
    "bg-inverted-background text-background border border-transparent shadow-sm hover:opacity-90",
  pill:
    "bg-transparent text-text-neutral-tertiary border border-transparent aria-[pressed=true]:bg-sunk-light aria-[pressed=true]:text-text-neutral-primary",
};

export interface IconButtonProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  title?: string;
  disabled?: boolean;
  /** For `pill` variant — controls the active fill via aria-pressed. */
  active?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
  children?: ReactNode;
}

export function IconButton({
  icon: Icon,
  size = "md",
  variant = "secondary",
  title,
  disabled = false,
  active = false,
  onClick,
  ...rest
}: IconButtonProps) {
  const s = SIZE_STYLES[size];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={variant === "pill" ? active : undefined}
      className={`flex shrink-0 items-center justify-center rounded-m transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${s.box} ${VARIANT_STYLES[variant]}`}
      aria-label={rest["aria-label"] ?? title}
    >
      <Icon size={s.icon} />
    </button>
  );
}

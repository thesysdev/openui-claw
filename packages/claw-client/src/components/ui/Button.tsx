"use client";

import type { ComponentType, MouseEventHandler, ReactNode } from "react";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "borderless"
  | "pill"
  | "destructive";

// Heights mirror `IconButton`'s sizes so a <Button size="md"> lines up with
// any <IconButton size="md"> siblings in the same row.
const SIZE_STYLES: Record<
  ButtonSize,
  { height: string; padding: string; text: string; icon: number }
> = {
  sm: { height: "h-l", padding: "px-s", text: "text-sm", icon: 12 },
  md: { height: "h-7", padding: "px-m", text: "text-md", icon: 13 },
  lg: { height: "h-2xl", padding: "px-ml", text: "text-md", icon: 14 },
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-interactive-accent text-background border border-transparent shadow-md hover:bg-interactive-accent-hover disabled:bg-interactive-accent-disabled disabled:shadow-none",
  secondary:
    "bg-background text-text-neutral-secondary border border-border-default shadow-sm hover:bg-sunk-light hover:text-text-neutral-primary dark:bg-foreground dark:border-border-default dark:hover:bg-sunk-light",
  tertiary:
    "bg-transparent text-text-neutral-tertiary border border-transparent hover:bg-sunk dark:hover:bg-sunk-light hover:text-text-neutral-primary",
  borderless:
    "bg-transparent text-text-neutral-tertiary border border-transparent hover:text-text-neutral-primary",
  pill: "bg-transparent text-text-neutral-tertiary border border-transparent aria-[pressed=true]:bg-sunk-light aria-[pressed=true]:text-text-neutral-primary",
  destructive:
    "bg-interactive-destructive text-text-white border border-transparent shadow-sm hover:bg-interactive-destructive-hover disabled:opacity-50",
};

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentType<{ size?: number; className?: string }>;
  /** Render the icon after the label (used for "View all →" style buttons). */
  iconTrailing?: boolean;
  /** For `pill` variant — controls the active fill via aria-pressed. */
  active?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * Text button with optional icon. Four variants and three sizes mirroring
 * the SantaClaw prototype — `primary` / `secondary` / `borderless` / `pill`
 * at `sm` / `md` / `lg`.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconTrailing = false,
  active = false,
  disabled = false,
  type = "button",
  title,
  className = "",
  onClick,
}: ButtonProps) {
  const s = SIZE_STYLES[size];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={variant === "pill" ? active : undefined}
      className={`inline-flex shrink-0 items-center gap-xs rounded-lg font-label font-regular whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${s.height} ${s.padding} ${s.text} ${VARIANT_STYLES[variant]} ${iconTrailing ? "flex-row-reverse" : ""} ${className}`}
    >
      {Icon ? <Icon size={s.icon} /> : null}
      {children}
    </button>
  );
}

"use client";

import type { ComponentType } from "react";

/**
 * Tile — the 24x24 box that sits at the start of every sidebar row.
 *
 * Four presentational variants:
 *   - icon:   neutral icon tile (Home, Search)
 *   - text:   single-letter tile (agent/app/artifact initials)
 *   - category: tinted tile carrying a section color (agents/apps/artifacts/home)
 *   - border: outlined tile used for "View all"
 */

export type TileCategory = "home" | "agents" | "apps" | "artifacts" | "crons" | null;

export const CATEGORY_STYLES: Record<
  Exclude<TileCategory, null>,
  { bg: string; icon: string; border: string }
> = {
  home: {
    bg: "bg-cat-context/10",
    icon: "text-cat-context",
    border: "border-cat-context/15",
  },
  agents: {
    bg: "bg-cat-agent/10",
    icon: "text-cat-agent",
    border: "border-cat-agent/15",
  },
  apps: {
    bg: "bg-cat-app/10",
    icon: "text-cat-app",
    border: "border-cat-app/15",
  },
  artifacts: {
    bg: "bg-cat-artifact/10",
    icon: "text-cat-artifact",
    border: "border-cat-artifact/15",
  },
  crons: {
    bg: "bg-cat-activity/10",
    icon: "text-cat-activity",
    border: "border-cat-activity/15",
  },
};

const BASE =
  "flex h-l w-l shrink-0 items-center justify-center rounded-m transition-[box-shadow,background-color,border-color] duration-150";

// ── Icon tile ───────────────────────────────────────────────────────────────

export function IconTile({
  icon: Icon,
  active = false,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  active?: boolean;
  /** Accepted for API compatibility; tile color does NOT change on hover. */
  hover?: boolean;
}) {
  const iconColor = active ? "text-text-neutral-primary" : "text-text-neutral-tertiary";
  return (
    <div
      className={`${BASE} border border-border-default/70 dark:border-border-default/16 bg-background dark:bg-elevated-light shadow-sm`}
    >
      <Icon size={11} className={iconColor} />
    </div>
  );
}

// ── Text / letter tile ──────────────────────────────────────────────────────

export function TextTile({
  label,
  active = false,
  category = null,
}: {
  label: string;
  active?: boolean;
  /** Accepted for API compatibility; tile color does NOT change on hover. */
  hover?: boolean;
  category?: TileCategory;
}) {
  // Letter always carries the category color when a category is set, so the
  // tile's bloom identity is visible at rest — not only in the active state.
  const textColor = category
    ? CATEGORY_STYLES[category].icon
    : active
      ? "text-text-neutral-primary"
      : "text-text-neutral-tertiary";
  return (
    <div
      className={`${BASE} border border-border-default/70 dark:border-border-default/16 bg-background dark:bg-elevated-light shadow-sm`}
    >
      <span className={`text-xs font-bold leading-none ${textColor}`}>
        {label.charAt(0).toUpperCase() || "?"}
      </span>
    </div>
  );
}

// ── Category tile (tinted, for section headers) ─────────────────────────────

export function CategoryTile({
  icon: Icon,
  category,
  subtle = true,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  category: Exclude<TileCategory, null>;
  /**
   * `true` (section header style): no shadow, stroke in the category color
   *        at low opacity so the tile reads as a soft tinted chip.
   * `false` (Home / popped nav row style): no visible border, `shadow-sm`.
   */
  subtle?: boolean;
}) {
  const c = CATEGORY_STYLES[category];
  const stroke = subtle ? `border ${c.border}` : "border border-transparent";
  const shadow = subtle ? "" : "shadow-sm";
  return (
    <div className={`${BASE} ${stroke} ${c.bg} ${shadow}`}>
      <Icon size={11} className={c.icon} />
    </div>
  );
}

// ── Border tile (outlined, for "View all") ──────────────────────────────────

export function BorderTile({
  icon: Icon,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Accepted for API compatibility; tile color does NOT change on hover. */
  hover?: boolean;
}) {
  return (
    <div
      className={`${BASE} border border-border-default dark:border-border-default/16 bg-transparent`}
    >
      <Icon size={10} className="text-text-neutral-tertiary" />
    </div>
  );
}

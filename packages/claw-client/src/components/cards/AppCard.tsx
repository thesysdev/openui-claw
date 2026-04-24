"use client";

import type { ComponentType, ReactNode } from "react";

import { relTime } from "@/lib/time";

export type AppCardCategory = "app" | "artifact";

export interface AppCardData {
  id: string;
  name: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  desc?: string;
  agent?: string;
  lastUsed?: string | number;
}

export interface AppCardProps {
  app: AppCardData;
  /** Optional chip rendered above the name (e.g. the artifact type label). */
  chip?: ReactNode;
  /** Tints the avatar tile; defaults to `"app"`. */
  category?: AppCardCategory;
  onClick?: () => void;
}

const CATEGORY_TILE: Record<AppCardCategory, string> = {
  app: "bg-cat-app/10 text-cat-app",
  artifact: "bg-cat-artifact/10 text-cat-artifact",
};

/**
 * Horizontal card — 52px avatar tile on the left, name + optional chip +
 * agent · time footer on the right. Used in the All apps / All artifacts
 * list views. Hover lifts the card (translateY + scale + card shadow),
 * matching the rest of the home/list tiles.
 */
export function AppCard({ app, chip, category = "app", onClick }: AppCardProps) {
  const Icon = app.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-w-0 items-stretch gap-ml overflow-hidden rounded-2xl border border-border-default/50 bg-popover-background p-ml text-left shadow-xl transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:scale-[1.015] hover:shadow-card dark:border-transparent dark:bg-foreground dark:hover:bg-popover-background"
    >
      <div
        className={`flex w-[52px] shrink-0 items-center justify-center rounded-xl ${CATEGORY_TILE[category]}`}
      >
        <Icon size={22} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {chip ? <div className="mb-[3px]">{chip}</div> : null}
        <p className="truncate font-body text-sm font-medium text-text-neutral-primary">
          {app.name}
        </p>
        {app.desc ? (
          <p className="mt-[2px] truncate font-body text-sm text-text-neutral-tertiary">
            {app.desc}
          </p>
        ) : null}
        {(app.agent || app.lastUsed != null) && (
          <div className="mt-[3px] flex items-center gap-xs">
            {app.agent ? (
              <span className="truncate font-body text-sm text-text-neutral-tertiary">
                {app.agent}
              </span>
            ) : null}
            {app.agent && app.lastUsed != null ? (
              <span className="leading-none text-text-neutral-tertiary/35">•</span>
            ) : null}
            {app.lastUsed != null ? (
              <span className="font-body text-sm text-text-neutral-tertiary">
                {relTime(app.lastUsed)}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </button>
  );
}

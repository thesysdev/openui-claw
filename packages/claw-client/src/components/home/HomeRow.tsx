"use client";

import { ChevronRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type HomeRowCategory = "agent" | "app" | "artifact" | "activity" | "task" | "context";

export interface HomeRowProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional trailing slot (badge, timestamp, frequency chip). */
  right?: ReactNode;
  /** Category tint for the icon tile. */
  category?: HomeRowCategory;
  onClick?: () => void;
}

const CATEGORY_ICON_COLOR: Record<HomeRowCategory, string> = {
  agent: "text-cat-agent",
  app: "text-cat-app",
  artifact: "text-cat-artifact",
  activity: "text-cat-activity",
  task: "text-cat-task",
  context: "text-cat-context",
};

const CATEGORY_BG: Record<HomeRowCategory, string> = {
  agent: "bg-cat-agent/10",
  app: "bg-cat-app/10",
  artifact: "bg-cat-artifact/10",
  activity: "bg-cat-activity/10",
  task: "bg-cat-task/10",
  context: "bg-cat-context/10",
};

/**
 * Generic homepage list row: 30x30 icon tile + title/subtitle + trailing slot +
 * a chevron that slides in on hover.
 */
export function HomeRow({ icon: Icon, title, subtitle, right, category = "app", onClick }: HomeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group -mx-s flex w-full items-center gap-m rounded-lg px-s py-s text-left transition-colors duration-150 hover:bg-sunk-light dark:hover:bg-elevated-light"
    >
      <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m transition-colors duration-150 ${CATEGORY_BG[category]}`}>
        <Icon size={14} className={CATEGORY_ICON_COLOR[category]} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-text-neutral-primary">{title}</p>
        {subtitle ? <p className="truncate font-body text-2xs text-text-neutral-tertiary/70">{subtitle}</p> : null}
      </div>
      {right}
      <ChevronRight size={14} className="shrink-0 -translate-x-2xs text-text-neutral-tertiary opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
    </button>
  );
}

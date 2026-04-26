"use client";

import { ChevronRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type MobileRowCategory = "agent" | "app" | "artifact" | "activity";

const CATEGORY_BG: Record<MobileRowCategory, string> = {
  agent: "bg-cat-agent/10",
  app: "bg-cat-app/10",
  artifact: "bg-cat-artifact/10",
  activity: "bg-cat-activity/10",
};

const CATEGORY_ICON: Record<MobileRowCategory, string> = {
  agent: "text-cat-agent",
  app: "text-cat-app",
  artifact: "text-cat-artifact",
  activity: "text-cat-activity",
};

interface MobileListRowProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  category: MobileRowCategory;
  onClick?: () => void;
}

export function MobileListRow({
  icon: Icon,
  title,
  subtitle,
  right,
  category,
  onClick,
}: MobileListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] w-full items-center gap-m bg-transparent px-ml py-m text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light"
    >
      <div
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m ${CATEGORY_BG[category]}`}
      >
        <Icon size={14} className={CATEGORY_ICON[category]} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-text-neutral-primary">{title}</p>
        {subtitle ? (
          <p className="truncate font-body text-2xs text-text-neutral-tertiary/70">{subtitle}</p>
        ) : null}
      </div>
      {right}
      <ChevronRight size={14} className="shrink-0 text-text-neutral-tertiary" />
    </button>
  );
}

export function MobileListCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default/50 bg-popover-background shadow-xl divide-y divide-border-default/50 dark:divide-border-default/16 dark:border-transparent dark:bg-foreground">
      {children}
    </div>
  );
}

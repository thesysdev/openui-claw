"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentType } from "react";

import { CategoryTile, type TileCategory } from "./Tile";
import { ROW_BASE, rowStateClass } from "./rowStates";

export interface SectionTabProps {
  /** Category used for the icon tile tint (agents/apps/artifacts/home). */
  category: Exclude<TileCategory, null>;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  open: boolean;
  hovered?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/** Collapsible section header — Agents, Apps, Artifacts. */
export function SectionTab({
  category,
  icon,
  label,
  open,
  hovered = false,
  collapsed = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: SectionTabProps) {
  const state = hovered ? "hover" : "rest";
  const gap = collapsed ? "gap-0" : "gap-s";
  const justify = collapsed ? "justify-center" : "justify-start";
  const labelFade = collapsed
    ? "opacity-0 max-w-0"
    : "opacity-100 max-w-[200px]";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${ROW_BASE} ${gap} ${justify} ${rowStateClass(state)} mb-px`}
    >
      <CategoryTile icon={icon} category={category} subtle />
      <span
        className={`flex-1 text-left text-xs font-medium overflow-hidden whitespace-nowrap ${
          hovered
            ? "text-text-neutral-secondary"
            : "text-text-neutral-tertiary"
        } ${labelFade} transition-[opacity,max-width,color] duration-300 ease-out`}
      >
        {label}
      </span>
      {!collapsed && (
        <div
          className="flex h-ml w-ml shrink-0 items-center justify-center transition-transform duration-300"
          style={{ transform: `rotate(${open ? 180 : 0}deg)` }}
        >
          <ChevronDown size={11} className="text-text-neutral-tertiary" />
        </div>
      )}
    </button>
  );
}

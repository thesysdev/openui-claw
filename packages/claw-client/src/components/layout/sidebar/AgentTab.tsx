"use client";

import { ChevronDown, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { TextTile } from "./Tile";
import { ROW_BASE, rowStateClass } from "./rowStates";

export interface AgentTabProps {
  name: string;
  active?: boolean;
  hovered?: boolean;
  expanded?: boolean;
  collapsed?: boolean;
  hasSessions?: boolean;
  onToggle?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onNewSession?: () => void;
  creating?: boolean;
  /** Expanded body (session list). */
  children?: ReactNode;
}

/**
 * Expandable agent entry. When expanded, renders as a "card" container
 * (white + stroke + shadow) holding its sessions + a "New session" action.
 */
export function AgentTab({
  name,
  active = false,
  hovered = false,
  expanded = false,
  collapsed = false,
  hasSessions = false,
  onToggle,
  onMouseEnter,
  onMouseLeave,
  onNewSession,
  creating = false,
  children,
}: AgentTabProps) {
  const cardActive = expanded || active;
  const cardState = cardActive ? "expanded" : hovered ? "hover" : "rest";
  const gap = collapsed ? "gap-0" : "gap-s";
  const justify = collapsed ? "justify-center" : "justify-start";
  const cardMargin = cardActive ? "my-2xs" : "mb-px";

  // Collapsed: hug the tile (square) instead of spanning sidebar width.
  const outerCls = collapsed
    ? `${rowStateClass(cardState)} shadow-none rounded-lg ${cardMargin} transition-[background-color,border-color,box-shadow,margin] duration-150 h-8 w-8 mx-auto`
    : `${rowStateClass(cardState)} shadow-none rounded-lg ${cardMargin} transition-[background-color,border-color,box-shadow,margin] duration-150`;
  const buttonCls = collapsed
    ? "flex h-full w-full items-center justify-center border-0 bg-transparent"
    : `${ROW_BASE} ${gap} ${justify} border-0 bg-transparent`;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={outerCls}
    >
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? name : undefined}
        className={buttonCls}
      >
        <TextTile
          label={name}
          active={cardActive}
          hover={hovered}
          category={cardActive ? "agents" : null}
        />
        <span
          className={`flex-1 text-left text-sm truncate overflow-hidden whitespace-nowrap ${
            cardActive || hovered
              ? "text-text-neutral-primary"
              : "text-text-neutral-secondary"
          } ${cardActive ? "font-medium" : "font-normal"} ${
            collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"
          } transition-[opacity,max-width] duration-300 ease-out`}
        >
          {name}
        </span>
        {!collapsed && hasSessions && (
          <div
            className="flex h-ml w-ml shrink-0 items-center justify-center transition-[transform,opacity] duration-200"
            style={{
              opacity: hovered || expanded ? 0.6 : 0,
              transform: `rotate(${expanded ? 180 : 0}deg)`,
            }}
          >
            <ChevronDown size={11} className="text-text-neutral-tertiary" />
          </div>
        )}
      </button>

      {!collapsed && expanded && (
        <div className="px-s pb-s">{children}</div>
      )}
    </div>
  );
}

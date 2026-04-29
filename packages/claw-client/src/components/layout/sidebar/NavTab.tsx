"use client";

import type { MouseEventHandler, ReactNode } from "react";

import { Counter } from "@/components/ui/Counter";

import { ROW_BASE, rowIsBold, rowLabelClass, rowStateClass } from "./rowStates";

export interface NavTabProps {
  /** Tile to render at the start of the row. */
  tile: ReactNode;
  label: string;
  /** Optional trailing slot (badge, chip, chevron). */
  trailing?: ReactNode;
  active?: boolean;
  hovered?: boolean;
  /** Collapsed sidebar hides labels + trailing content. */
  collapsed?: boolean;
  /** `true` when the tile is a border-outline tile ("View all"). */
  muted?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  href?: string;
  title?: string;
}

/**
 * The "default" sidebar row — used for Home, Search, individual apps,
 * individual artifacts, and the "View all" link.
 */
export function NavTab({
  tile,
  label,
  trailing,
  active = false,
  hovered = false,
  collapsed = false,
  muted = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  href,
  title,
}: NavTabProps) {
  const state = active ? "active" : hovered ? "hover" : "rest";
  const gap = collapsed ? "gap-0" : "gap-s";
  const justify = collapsed ? "justify-center" : "justify-start";
  const labelColor = muted
    ? state === "hover" || state === "active"
      ? "text-text-neutral-primary"
      : "text-text-neutral-tertiary"
    : rowLabelClass(state);
  const weight = rowIsBold(state) ? "font-medium" : "font-normal";
  const labelFade = collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]";

  const body = (
    <>
      {tile}
      <span
        className={`flex-1 text-left text-sm overflow-hidden whitespace-nowrap text-ellipsis ${labelColor} ${weight} ${labelFade} transition-[opacity,max-width] duration-300 ease-out`}
      >
        {label}
      </span>
      {!collapsed && trailing ? trailing : null}
    </>
  );

  // Collapsed: button shrinks to a square that hugs the tile + padding
  // (instead of spanning the full sidebar width) so the active fill reads
  // as a square. Expanded: normal full-width row.
  const layoutCls = collapsed
    ? "flex h-8 w-8 mx-auto items-center justify-center rounded-lg transition-[background-color,border-color,box-shadow] duration-150"
    : `${ROW_BASE} ${gap} ${justify}`;
  const cls = `${layoutCls} ${rowStateClass(state)} mb-px cursor-pointer`;

  if (href) {
    return (
      <a
        href={href}
        title={collapsed ? (title ?? label) : title}
        className={cls}
        onClick={onClick as unknown as MouseEventHandler<HTMLAnchorElement>}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      title={collapsed ? (title ?? label) : title}
      className={cls}
      onClick={onClick as unknown as MouseEventHandler<HTMLButtonElement>}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {body}
    </button>
  );
}

/** Red unread badge — thin wrapper over `Counter` with a leading margin. */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Counter size="md" color="red" kind="primary" className="ml-2xs">
      {count}
    </Counter>
  );
}

"use client";

import type { ReactNode } from "react";

export interface TopBarProps {
  /**
   * Optional leading slot — usually a back button or collapse toggle.
   * Renders before the main content area.
   */
  leading?: ReactNode;
  /**
   * Main content — title, switcher, tabs, whatever belongs on the left side.
   * Fills the available horizontal space.
   */
  children?: ReactNode;
  /**
   * Right-side actions — icon buttons, CTAs, close ✕.
   */
  actions?: ReactNode;
  /** Extra classes for the outer row if the caller needs to tweak layout. */
  className?: string;
}

/**
 * Shared app-level top bar. Used for the agent chat header, app preview
 * modal, artifact preview modal, refine tray header — anywhere we want the
 * consistent 48px-tall chrome row above content.
 *
 * Layout: `[leading] [children (flex-1)] [actions]`
 *   - Fixed 48 px min-height
 *   - `px-4 py-2` horizontal padding
 *   - `border-b` 1 px divider matching the default border token
 *   - `bg-background` so it reads as the same paper as the nav/sidepane heads
 */
export function TopBar({ leading, children, actions, className = "" }: TopBarProps) {
  return (
    <div
      className={`flex h-[48px] shrink-0 items-center gap-3 border-b border-border-default/40 bg-background px-4 dark:border-border-default/16 ${className}`}
    >
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

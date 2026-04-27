"use client";

import { BellOff, BellRing, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";

import { Counter } from "@/components/ui/Counter";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/layout/sidebar/IconButton";

import { NeedsInputCard } from "./NeedsInputCard";
import { NotifRow } from "./NotifRow";
import type { HomeNotif, NotifType } from "./types";

type Filter = "all" | "needs_input" | "alerts";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  needs_input: "Needs input",
  alerts: "Alerts",
};
const FILTER_KEYS: Filter[] = ["all", "needs_input", "alerts"];
const FILTER_TYPE: Record<Filter, NotifType | null> = {
  all: null,
  needs_input: "needs_input",
  alerts: "alert",
};

export interface NotifPanelProps {
  notifications: HomeNotif[];
  onOpenNotif?: (n: HomeNotif) => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void | Promise<void>;
  onAction?: (n: HomeNotif) => void;
  collapsed?: boolean;
  onToggleCollapsed?: (next: boolean) => void;
}

/**
 * Home-screen notifications panel. Filter chips at the top (All / Needs input /
 * Alerts). Unread needs-input items still get their richer card treatment at
 * the top of the list because they require a user action. When `collapsed` is
 * true the panel shrinks to a thin rail with the unread badge.
 */
export function NotifPanel({
  notifications,
  onOpenNotif,
  onMarkRead,
  onMarkAllRead,
  onAction,
  collapsed = false,
  onToggleCollapsed,
}: NotifPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: notifications.length,
      needs_input: notifications.filter((n) => n.type === "needs_input").length,
      alerts: notifications.filter((n) => n.type === "alert").length,
    }),
    [notifications],
  );

  const filtered = useMemo(() => {
    const type = FILTER_TYPE[filter];
    return type == null ? notifications : notifications.filter((n) => n.type === type);
  }, [filter, notifications]);

  const needsInputCards = useMemo(
    () => filtered.filter((n) => n.type === "needs_input" && !n.read),
    [filtered],
  );

  const rows = useMemo(
    () => filtered.filter((n) => !(n.type === "needs_input" && !n.read)),
    [filtered],
  );

  if (collapsed) {
    return (
      <aside className="flex h-full w-12 shrink-0 flex-col items-center border-l border-border-default/50 py-m dark:border-border-default/16">
        <IconButton
          icon={PanelRightOpen}
          variant="tertiary"
          size="md"
          title="Show notifications"
          aria-label="Show notifications"
          onClick={() => onToggleCollapsed?.(false)}
        />
        <button
          type="button"
          onClick={() => onToggleCollapsed?.(false)}
          className="relative mt-m flex h-l w-l items-center justify-center rounded-m text-text-neutral-tertiary transition-colors hover:bg-sunk-light hover:text-text-neutral-primary dark:hover:bg-foreground"
          title={unread > 0 ? `${unread} unread` : "Notifications"}
          aria-label={unread > 0 ? `${unread} unread` : "Notifications"}
        >
          <BellRing size={16} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-status-error px-[4px] py-[1px] text-2xs font-bold text-background">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </aside>
    );
  }

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border-default/50 dark:border-border-default/16">
      <div className="border-b border-border-default/50 px-ml py-ml dark:border-border-default/16">
        <div className="mb-m flex items-center gap-s">
          <span className="font-heading text-md font-bold text-text-neutral-primary">
            Notifications
          </span>
          {unread > 0 ? (
            <Counter size="md" color="red" kind="primary">
              {unread}
            </Counter>
          ) : null}
          <div className="ml-auto flex items-center gap-xs">
            {onMarkAllRead && unread > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void onMarkAllRead();
                }}
                className="rounded-m px-s py-2xs font-label text-xs text-text-neutral-secondary transition-colors hover:bg-sunk-light hover:text-text-neutral-primary dark:hover:bg-foreground"
                title="Mark all as read"
              >
                Mark all read
              </button>
            ) : null}
            {onToggleCollapsed ? (
              <IconButton
                icon={PanelRightClose}
                variant="tertiary"
                size="md"
                title="Collapse notifications"
                aria-label="Collapse notifications"
                onClick={() => onToggleCollapsed(true)}
              />
            ) : null}
          </div>
        </div>
        <FilterChips<Filter>
          value={filter}
          onChange={setFilter}
          options={FILTER_KEYS.map((f) => ({
            value: f,
            label: FILTER_LABELS[f],
            count: counts[f],
          }))}
          ariaLabel="Notification filter"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-s py-s">
        {needsInputCards.length > 0 ? (
          <div className="px-xs pb-s pt-xs">
            {needsInputCards.map((n) => (
              <NeedsInputCard
                key={`card-${n.id}`}
                notif={n}
                onAction={() => onAction?.(n)}
                onClick={() => onOpenNotif?.(n)}
              />
            ))}
          </div>
        ) : null}

        {rows.length === 0 && needsInputCards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-s px-ml text-center">
            <BellOff size={16} className="text-text-neutral-tertiary/60" />
            <p className="font-body text-sm text-text-neutral-tertiary">
              It&apos;s quiet here
            </p>
          </div>
        ) : (
          rows.map((n, i) => (
            <NotifRow
              key={n.id}
              notif={n}
              isLast={i === rows.length - 1}
              onClick={() => onOpenNotif?.(n)}
              onMarkRead={() => onMarkRead?.(n.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import { Counter } from "@/components/ui/Counter";

import { NeedsInputCard } from "./NeedsInputCard";
import { NotifRow } from "./NotifRow";
import type { HomeNotif, NotifType } from "./types";

type Filter = "all" | "tasks" | "needs input" | "alerts";

const FILTER_KEYS: Filter[] = ["all", "tasks", "needs input", "alerts"];
const FILTER_TYPE: Record<Filter, NotifType | null> = {
  all: null,
  tasks: "task",
  "needs input": "needs_input",
  alerts: "alert",
};

export interface NotifPanelProps {
  notifications: HomeNotif[];
  onOpenNotif?: (n: HomeNotif) => void;
  onMarkRead?: (id: string) => void;
  onAction?: (n: HomeNotif) => void;
}

/** Right-side panel: header with tabs + scrollable list of notifications. */
export function NotifPanel({
  notifications,
  onOpenNotif,
  onMarkRead,
  onAction,
}: NotifPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: notifications.length,
      tasks: notifications.filter((n) => n.type === "task").length,
      "needs input": notifications.filter((n) => n.type === "needs_input").length,
      alerts: notifications.filter((n) => n.type === "alert").length,
    }),
    [notifications],
  );

  const filtered = useMemo(() => {
    const type = FILTER_TYPE[filter];
    return type == null ? notifications : notifications.filter((n) => n.type === type);
  }, [filter, notifications]);

  const needsInputCards = useMemo(
    () => notifications.filter((n) => n.type === "needs_input" && !n.read),
    [notifications],
  );

  const showCards = filter === "all" || filter === "needs input";

  /** Notifications to render as regular rows (needs_input-unread excluded when shown as cards). */
  const rows = useMemo(() => {
    return filtered.filter(
      (n) => !(showCards && n.type === "needs_input" && !n.read),
    );
  }, [filtered, showCards]);

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border-default/50 dark:border-border-default/16">
      {/* ── Header ── */}
      <div className="px-ml pt-ml">
        <div className="mb-m flex items-center gap-s">
          <span className="font-heading text-md font-bold text-text-neutral-primary">
            Notifications
          </span>
          {unread > 0 ? (
            <Counter size="md" color="red" kind="primary">
              {unread}
            </Counter>
          ) : null}
        </div>
        <div
          className="flex gap-ml border-b border-border-default/50 dark:border-border-default/16"
          style={{ marginBottom: "-1px" }}
        >
          {FILTER_KEYS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex items-center gap-xs border-b-2 px-0 py-xs font-label text-xs capitalize transition-colors duration-150 ${
                  active
                    ? "border-text-neutral-primary text-text-neutral-primary font-medium"
                    : "border-transparent text-text-neutral-tertiary hover:text-text-neutral-secondary font-regular"
                }`}
              >
                {f}
                <Counter
                  size="md"
                  color="neutral"
                  kind={active ? "subtle" : "secondary"}
                >
                  {counts[f]}
                </Counter>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-s py-s">
        {showCards && needsInputCards.length > 0 ? (
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

        {rows.length === 0 ? (
          <p className="px-ml py-xl text-center font-body text-sm text-text-neutral-tertiary">
            {filtered.length === 0
              ? "No notifications"
              : "Only needs-input items — see above"}
          </p>
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

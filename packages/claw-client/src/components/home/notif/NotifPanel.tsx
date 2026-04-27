"use client";

import { BellOff } from "lucide-react";
import { useMemo, useState } from "react";

import { Counter } from "@/components/ui/Counter";
import { FilterChips } from "@/components/ui/FilterChips";

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
    () => notifications.filter((n) => n.type === "needs_input" && !n.read),
    [notifications],
  );

  const showCards = filter === "all" || filter === "needs_input";

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
        <div className="pb-m">
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
          filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-s px-ml text-center">
              <BellOff size={16} className="text-text-neutral-tertiary/60" />
              <p className="font-body text-sm text-text-neutral-tertiary">
                It&apos;s quiet here
              </p>
            </div>
          ) : null
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

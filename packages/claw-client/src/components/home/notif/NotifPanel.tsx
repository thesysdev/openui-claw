"use client";

import { BellOff } from "lucide-react";
import { useMemo } from "react";

import { Counter } from "@/components/ui/Counter";

import { NeedsInputCard } from "./NeedsInputCard";
import { NotifRow } from "./NotifRow";
import type { HomeNotif } from "./types";

export interface NotifPanelProps {
  notifications: HomeNotif[];
  onOpenNotif?: (n: HomeNotif) => void;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void | Promise<void>;
  onAction?: (n: HomeNotif) => void;
}

/**
 * Home-screen notifications panel — single flat list sorted by recency.
 * Unread "needs input" items still get the richer card treatment at the
 * top because they require a user action.
 */
export function NotifPanel({
  notifications,
  onOpenNotif,
  onMarkRead,
  onMarkAllRead,
  onAction,
}: NotifPanelProps) {
  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const needsInputCards = useMemo(
    () => notifications.filter((n) => n.type === "needs_input" && !n.read),
    [notifications],
  );

  const rows = useMemo(
    () => notifications.filter((n) => !(n.type === "needs_input" && !n.read)),
    [notifications],
  );

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border-default/50 dark:border-border-default/16">
      <div className="border-b border-border-default/50 px-ml py-ml dark:border-border-default/16">
        <div className="flex items-center gap-s">
          <span className="font-heading text-md font-bold text-text-neutral-primary">
            Notifications
          </span>
          {unread > 0 ? (
            <Counter size="md" color="red" kind="primary">
              {unread}
            </Counter>
          ) : null}
          {onMarkAllRead && unread > 0 ? (
            <button
              type="button"
              onClick={() => {
                void onMarkAllRead();
              }}
              className="ml-auto rounded-m px-s py-2xs font-label text-xs text-text-neutral-secondary transition-colors hover:bg-sunk-light hover:text-text-neutral-primary dark:hover:bg-foreground"
              title="Mark all as read"
            >
              Mark all read
            </button>
          ) : null}
        </div>
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

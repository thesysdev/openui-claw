"use client";

import type { NotificationRecord } from "@/lib/notifications";
import { AlertTriangle, BellRing, CheckCircle2, Inbox, PanelRightOpen, X } from "lucide-react";
import { useMemo } from "react";

/**
 * Per-card category tag — kept (visual scanning aid on the card itself) but
 * the four-tab filter strip at the top of the inbox is gone. Same call as
 * the home `NotifPanel`: users want one flat list sorted by recency.
 */
type NotificationCategory = "tasks" | "needs_input" | "alerts";

function notificationCategory(notification: NotificationRecord): NotificationCategory {
  const kind = notification.kind.toLowerCase();

  if (kind.includes("needs_input") || kind.includes("approval")) {
    return "needs_input";
  }

  if (
    kind.includes("attention") ||
    kind.includes("alert") ||
    kind.includes("error") ||
    kind.includes("failed")
  ) {
    return "alerts";
  }

  return "tasks";
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function badgeClasses(category: NotificationCategory): string {
  switch (category) {
    case "needs_input":
      return "border-border-alert bg-alert-background text-text-alert-primary";
    case "alerts":
      return "border-border-danger bg-danger-background text-text-danger-primary";
    default:
      return "border-border-info bg-info-background text-text-info-primary";
  }
}

function badgeLabel(category: NotificationCategory): string {
  switch (category) {
    case "needs_input":
      return "Needs input";
    case "alerts":
      return "Alert";
    default:
      return "Task";
  }
}

function actionLabel(notification: NotificationRecord): string {
  switch (notification.target.view) {
    case "app":
      return "Open app";
    case "artifact":
      return "Open artifact";
    case "chat":
      return notificationCategory(notification) === "needs_input" ? "Review thread" : "Open thread";
    case "crons":
      return "Open cron";
    default:
      return "Open";
  }
}

function sourceLabel(notification: NotificationRecord): string {
  if (notification.kind === "thread_reply") return "Conversation reply";
  if (notification.kind.startsWith("cron_")) return "Scheduled run";
  if (notification.source?.agentId) return notification.source.agentId;
  switch (notification.target.view) {
    case "app":
      return "Workspace app";
    case "artifact":
      return "Workspace artifact";
    case "chat":
      return "Conversation";
    case "crons":
      return "Scheduled run";
    default:
      return "Workspace";
  }
}

function NotificationCard({
  notification,
  onOpenNotification,
}: {
  notification: NotificationRecord;
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
}) {
  const category = notificationCategory(notification);

  return (
    <article className="rounded-2xl border border-border-default/70 bg-background p-ml shadow-card">
      <div className="flex items-start justify-between gap-m">
        <div className="min-w-0 flex-1">
          <div className="mb-s flex items-center gap-s">
            <span
              className={`rounded-m border px-s py-3xs text-2xs font-bold uppercase tracking-[0.14em] ${badgeClasses(category)}`}
            >
              {badgeLabel(category)}
            </span>
            {notification.unread ? (
              <span className="inline-flex h-s w-s rounded-full bg-text-neutral-primary" />
            ) : null}
          </div>
          <h3 className="truncate text-sm font-bold text-text-neutral-primary">
            {notification.title}
          </h3>
        </div>
        {category === "alerts" ? (
          <AlertTriangle className="mt-3xs h-ml w-ml shrink-0 text-interactive-destructive" />
        ) : category === "needs_input" ? (
          <BellRing className="mt-3xs h-ml w-ml shrink-0 text-text-alert-primary" />
        ) : (
          <CheckCircle2 className="mt-3xs h-ml w-ml shrink-0 text-text-info-primary" />
        )}
      </div>

      <p className="mt-s text-sm leading-5 text-text-neutral-secondary">{notification.message}</p>

      <div className="mt-ml flex items-center justify-between gap-m">
        <div className="min-w-0 text-xs text-text-neutral-tertiary">
          <span className="truncate">{sourceLabel(notification)}</span>
          <span className="mx-xs text-border-default">•</span>
          <span>{formatRelativeTime(notification.updatedAt)}</span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-border-default bg-background px-m py-s text-xs font-medium text-text-neutral-secondary shadow-sm transition-colors hover:bg-sunk-light dark:border-border-default/16 dark:bg-foreground dark:hover:bg-elevated"
          onClick={() => {
            void onOpenNotification(notification);
          }}
        >
          {actionLabel(notification)}
        </button>
      </div>
    </article>
  );
}

function NotificationInboxContent({
  notifications,
  onOpenNotification,
  onMarkAllRead,
}: {
  notifications: NotificationRecord[];
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications],
  );

  const visibleNotifications = useMemo(
    () =>
      [...notifications].sort((left, right) => {
        if (left.unread !== right.unread) return left.unread ? -1 : 1;
        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    [notifications],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border-default/80 px-ml py-ml">
        <div className="flex items-center justify-between gap-m">
          <div className="min-w-0">
            <div className="flex items-center gap-s">
              <BellRing className="h-ml w-ml text-text-neutral-tertiary" />
              <h2 className="text-sm font-bold text-text-neutral-primary">Notifications</h2>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-text-neutral-primary px-s py-3xs text-2xs font-bold text-background">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <p className="mt-2xs text-xs text-text-neutral-tertiary">
              Durable updates, approvals, and background outcomes.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-s">
            {onMarkAllRead ? (
              <button
                type="button"
                className="rounded-xl border border-border-default bg-background px-m py-s text-xs font-medium text-text-neutral-secondary shadow-sm transition-colors hover:bg-sunk-light dark:border-border-default/16 dark:bg-foreground dark:hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  void onMarkAllRead();
                }}
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-ml py-ml">
        {visibleNotifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border-default/80 bg-background px-l py-2xl text-center">
            <Inbox className="mb-m h-2xl w-2xl text-text-neutral-tertiary" />
            <p className="text-sm font-medium text-text-neutral-secondary">
              No notifications here yet
            </p>
            <p className="mt-2xs text-sm text-text-neutral-tertiary">
              Cron runs and other background attention items will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-m">
            {visibleNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onOpenNotification={onOpenNotification}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationInboxPane(props: {
  notifications: NotificationRecord[];
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  return (
    <aside className="hidden h-full w-[348px] shrink-0 border-l border-border-default/70 bg-foreground xl:block">
      <NotificationInboxContent {...props} />
    </aside>
  );
}

export function NotificationInboxDrawer({
  open,
  onClose,
  ...props
}: {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex xl:hidden">
      <button
        type="button"
        className="flex-1 bg-overlay"
        onClick={onClose}
        aria-label="Close notifications"
      />
      <div className="flex h-full w-[min(92vw,380px)] flex-col border-l border-border-default bg-background shadow-float">
        <div className="flex items-center justify-between border-b border-border-default px-ml py-m">
          <div className="flex items-center gap-s">
            <div className="flex h-2xl w-2xl items-center justify-center rounded-xl bg-sunk-light text-text-neutral-secondary">
              <PanelRightOpen className="h-ml w-ml" />
            </div>
            <div>
              <div className="text-sm font-bold text-text-neutral-primary">Notifications</div>
              <div className="text-xs text-text-neutral-tertiary">
                Inbox and background activity
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-s text-text-neutral-tertiary hover:bg-sunk-light hover:text-text-neutral-primary"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X className="h-ml w-ml" />
          </button>
        </div>
        <NotificationInboxContent {...props} />
      </div>
    </div>
  );
}

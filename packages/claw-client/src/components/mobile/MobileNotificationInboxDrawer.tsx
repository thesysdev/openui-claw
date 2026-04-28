"use client";

import { X } from "lucide-react";
import { useMemo } from "react";

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileButton } from "@/components/mobile/MobileButton";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import type { NotificationRecord } from "@/lib/notifications";

type NotifCategory = "needs_input" | "alerts" | "tasks";

function notificationCategory(notification: NotificationRecord): NotifCategory {
  const kind = notification.kind.toLowerCase();
  if (kind.includes("needs_input") || kind.includes("approval")) return "needs_input";
  if (
    kind.includes("attention") ||
    kind.includes("alert") ||
    kind.includes("error") ||
    kind.includes("failed")
  )
    return "alerts";
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
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tagClasses(tab: NotifCategory): string {
  switch (tab) {
    case "needs_input":
      return "border-border-alert bg-alert-background text-text-alert-primary";
    case "alerts":
      return "border-border-danger bg-danger-background text-text-danger-primary";
    default:
      return "border-border-info bg-info-background text-text-info-primary";
  }
}

function tagLabel(tab: NotifCategory): string {
  switch (tab) {
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
    default:
      return "Open";
  }
}

function sourceLabel(notification: NotificationRecord): string {
  if (notification.kind === "thread_reply") return "Conversation reply";
  if (notification.source?.agentId) return notification.source.agentId;
  switch (notification.target.view) {
    case "app":
      return "Workspace app";
    case "artifact":
      return "Workspace artifact";
    case "chat":
      return "Conversation";
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
    <article className="flex flex-col gap-m rounded-2xl border border-border-default/70 bg-background p-ml shadow-card">
      <div className="flex items-start gap-s">
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-text-neutral-primary">
          {notification.title}
        </h3>
        {notification.unread ? (
          <span className="mt-3xs inline-flex h-s w-s shrink-0 rounded-full bg-text-neutral-primary" />
        ) : null}
      </div>

      <p className="text-sm leading-5 text-text-neutral-secondary">{notification.message}</p>

      <div className="flex flex-wrap items-center gap-s">
        <span
          className={`rounded-m border px-xs py-0 text-2xs font-medium ${tagClasses(category)}`}
        >
          {tagLabel(category)}
        </span>
        <span className="truncate text-sm text-text-neutral-tertiary">
          {sourceLabel(notification)}
        </span>
        <span className="text-text-neutral-tertiary">·</span>
        <span className="text-sm text-text-neutral-tertiary">
          {formatRelativeTime(notification.updatedAt)}
        </span>
      </div>

      <MobileButton
        variant="secondary"
        fullWidth
        onClick={() => {
          void onOpenNotification(notification);
        }}
      >
        {actionLabel(notification)}
      </MobileButton>
    </article>
  );
}

export function MobileNotificationInboxDrawer({
  open,
  onClose,
  notifications,
  onOpenNotification,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  useBodyScrollLock(open);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
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

  if (!open) return null;

  return (
    <div className="claw-fade-in fixed inset-0 z-[80] flex flex-col bg-background">
      <header
        className="flex shrink-0 items-center justify-between gap-s bg-background px-ml py-m"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-heading text-md font-bold text-text-neutral-primary">Notifications</h2>
        <div className="flex shrink-0 items-center gap-s">
          {onMarkAllRead ? (
            <MobileButton
              variant="secondary"
              onClick={() => {
                void onMarkAllRead();
              }}
              disabled={unreadCount === 0}
            >
              Mark all read
            </MobileButton>
          ) : null}
          <HeaderIconButton onClick={onClose} label="Close notifications">
            <X size={18} />
          </HeaderIconButton>
        </div>
      </header>

      <div
        className="flex-1 overflow-y-auto px-ml pb-2xl pt-m"
        style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom))" }}
      >
        {visibleNotifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-ml text-center">
            <p className="text-sm text-text-neutral-tertiary">
              No notifications here yet. Cron runs and other background attention items will show
              up here.
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

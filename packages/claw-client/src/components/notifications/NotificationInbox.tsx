"use client";

import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Inbox,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { NotificationRecord } from "@/lib/notifications";

type InboxTab = "all" | "tasks" | "needs_input" | "alerts";

const TAB_ORDER: Array<{ id: InboxTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "tasks", label: "Tasks" },
  { id: "needs_input", label: "Needs Input" },
  { id: "alerts", label: "Alerts" },
];

function notificationCategory(notification: NotificationRecord): Exclude<InboxTab, "all"> {
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

function badgeClasses(tab: Exclude<InboxTab, "all">): string {
  switch (tab) {
    case "needs_input":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
    case "alerts":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300";
  }
}

function badgeLabel(tab: Exclude<InboxTab, "all">): string {
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
    <article className="rounded-2xl border border-white/70 bg-white/82 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.32)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/72">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${badgeClasses(category)}`}
            >
              {badgeLabel(category)}
            </span>
            {notification.unread ? (
              <span className="inline-flex h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            ) : null}
          </div>
          <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {notification.title}
          </h3>
        </div>
        {category === "alerts" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
        ) : category === "needs_input" ? (
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        )}
      </div>

      <p className="mt-2 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
        {notification.message}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="truncate">{sourceLabel(notification)}</span>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">•</span>
          <span>{formatRelativeTime(notification.updatedAt)}</span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
  onCollapse,
}: {
  notifications: NotificationRecord[];
  onOpenNotification: (notification: NotificationRecord) => void | Promise<void>;
  onMarkAllRead?: () => void | Promise<void>;
  onCollapse?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<InboxTab>("all");

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications],
  );

  const counts = useMemo(
    () =>
      TAB_ORDER.reduce<Record<InboxTab, number>>(
        (result, tab) => {
          result[tab.id] =
            tab.id === "all"
              ? notifications.length
              : notifications.filter(
                  (notification) => notificationCategory(notification) === tab.id,
                ).length;
          return result;
        },
        { all: 0, tasks: 0, needs_input: 0, alerts: 0 },
      ),
    [notifications],
  );

  const visibleNotifications = useMemo(() => {
    const items =
      activeTab === "all"
        ? notifications
        : notifications.filter(
            (notification) => notificationCategory(notification) === activeTab,
          );

    return [...items].sort((left, right) => {
      if (left.unread !== right.unread) return left.unread ? -1 : 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [activeTab, notifications]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Notifications
              </h2>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Durable updates, approvals, and background outcomes.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onMarkAllRead ? (
              <button
                type="button"
                className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => {
                  void onMarkAllRead();
                }}
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
            ) : null}
            {onCollapse ? (
              <button
                type="button"
                className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                onClick={onCollapse}
                aria-label="Collapse notifications"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} {counts[tab.id]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {visibleNotifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200/80 bg-white/55 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <Inbox className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              No notifications here yet
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cron runs and other background attention items will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
  onCollapse?: () => void;
}) {
  return (
    <aside className="hidden h-full w-[348px] shrink-0 border-l border-zinc-200/70 bg-gradient-to-b from-white/95 via-white/92 to-sky-50/35 dark:border-zinc-800 dark:from-zinc-950/92 dark:via-zinc-950/82 dark:to-sky-950/25 xl:block">
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
        className="flex-1 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close notifications"
      />
      <div className="flex h-full w-[min(92vw,380px)] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <PanelRightOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Notifications
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Inbox and background activity
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <NotificationInboxContent {...props} />
      </div>
    </div>
  );
}

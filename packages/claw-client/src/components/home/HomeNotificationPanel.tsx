"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Bell, ChevronRight } from "lucide-react";
import type { NotificationRecord } from "@/lib/notifications";
import { Tag } from "@/components/ui/Tag";
import { StatusDot } from "@/components/ui/StatusDot";
import { UnreadBadge } from "@/components/ui/UnreadBadge";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

type Tab = "all" | "tasks" | "needs_input" | "alerts";

const TAB_ORDER: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All" },
  { id: "tasks", label: "Tasks" },
  { id: "needs_input", label: "Needs input" },
  { id: "alerts", label: "Alerts" },
];

type Tone = "info" | "success" | "alert" | "danger" | "purple" | "pink" | "neutral";

const KIND_TONE: Record<Tab, Tone> = {
  all: "neutral",
  tasks: "info",
  needs_input: "alert",
  alerts: "danger",
};

const PANEL_STYLE: CSSProperties = {
  width: 360,
  flexShrink: 0,
  height: "100%",
  borderLeft: "1px solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  display: "flex",
  flexDirection: "column",
};

const HEADER_STYLE: CSSProperties = {
  padding: "var(--sp-ml) var(--sp-ml)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sp-m)",
};

const TITLE_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-s)",
};

const TITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "var(--fs-md)",
  fontWeight: "var(--fw-bold)",
  color: "var(--color-text-primary)",
};

const TABS_STYLE: CSSProperties = {
  display: "flex",
  gap: "var(--sp-m)",
  flexWrap: "wrap",
};

const BODY_STYLE: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--sp-m) var(--sp-ml)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sp-s)",
};

const EMPTY_STYLE: CSSProperties = {
  padding: "var(--sp-2xl) var(--sp-m)",
  textAlign: "center",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text-tertiary)",
};

// ── HELPERS ────────────────────────────────────────────────────────────────

function categoryOf(n: NotificationRecord): Exclude<Tab, "all"> {
  const kind = n.kind.toLowerCase();
  if (kind.includes("needs_input") || kind.includes("approval")) return "needs_input";
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

function categoryLabel(cat: Exclude<Tab, "all">): string {
  if (cat === "needs_input") return "Needs input";
  if (cat === "alerts") return "Alert";
  return "Task";
}

function formatRelative(value: string): string {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "just now";
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.round(diff / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sourceLabel(n: NotificationRecord): string {
  if (n.source?.agentId) return n.source.agentId;
  switch (n.target.view) {
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

function actionLabel(n: NotificationRecord): string {
  switch (n.target.view) {
    case "app":
      return "Open app";
    case "artifact":
      return "Open artifact";
    case "chat":
      return categoryOf(n) === "needs_input" ? "Review thread" : "Open thread";
    default:
      return "Open";
  }
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-xs)",
        padding: "var(--sp-2xs) 0",
        background: "transparent",
        border: "none",
        borderBottom: active
          ? "2px solid var(--color-text-accent-primary)"
          : "2px solid transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        fontFamily: "var(--font-label)",
        fontSize: "var(--fs-sm)",
        fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
        cursor: "pointer",
        transition: "color 0.15s ease, border-color 0.15s ease",
      }}
    >
      {label}
      <span
        style={{
          minWidth: 18,
          height: 18,
          padding: "0 var(--sp-xs)",
          borderRadius: "var(--r-full)",
          backgroundColor: "var(--color-sunk-light)",
          color: "var(--color-text-tertiary)",
          fontSize: "var(--fs-2xs)",
          fontWeight: "var(--fw-medium)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function NeedsInputCard({
  notification,
  onOpen,
}: {
  notification: NotificationRecord;
  onOpen: (n: NotificationRecord) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "var(--sp-ml)",
        borderRadius: "var(--r-l)",
        backgroundColor: "var(--color-elevated)",
        border: `1px solid ${hover ? "var(--color-border-interactive)" : "var(--color-border)"}`,
        boxShadow: "var(--shadow-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-s)",
        transition: "border-color 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-xs)" }}>
        <Tag tone="alert">Needs input</Tag>
        {notification.unread ? <StatusDot size={6} color="var(--color-destructive)" /> : null}
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--fs-sm)",
          fontWeight: "var(--fw-bold)",
          color: "var(--color-text-primary)",
        }}
      >
        {notification.title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-xs)",
          color: "var(--color-text-secondary)",
          lineHeight: "var(--lh-body)",
        }}
      >
        {notification.message}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--sp-s)",
          marginTop: "var(--sp-2xs)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: "var(--fs-2xs)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {sourceLabel(notification)} · {formatRelative(notification.updatedAt)}
        </div>
        <button
          type="button"
          onClick={() => onOpen(notification)}
          style={{
            padding: "var(--sp-xs) var(--sp-s)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-m)",
            background: "var(--color-bg)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-label)",
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-medium)",
            cursor: "pointer",
          }}
        >
          {actionLabel(notification)}
        </button>
      </div>
    </article>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationRecord;
  onOpen: (n: NotificationRecord) => void;
}) {
  const [hover, setHover] = useState(false);
  const cat = categoryOf(notification);
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(notification)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-s)",
        padding: "var(--sp-m) var(--sp-m)",
        borderRadius: "var(--r-l)",
        background: hover ? "var(--color-sunk-light)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        opacity: notification.unread ? 1 : 0.6,
        transition: "background-color 0.15s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Tag tone={KIND_TONE[cat]}>{categoryLabel(cat)}</Tag>
          {notification.unread ? (
            <StatusDot size={6} color="var(--color-destructive)" />
          ) : null}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-xs)",
            color: "var(--color-text-secondary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {notification.message}
        </div>
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: "var(--fs-2xs)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {sourceLabel(notification)} · {formatRelative(notification.updatedAt)}
        </div>
      </div>
      <ChevronRight
        size={14}
        color="var(--color-text-tertiary)"
        style={{
          marginTop: 6,
          opacity: hover ? 1 : 0,
          transform: hover ? "translateX(0)" : "translateX(-4px)",
          transition: "opacity 0.15s ease, transform 0.15s ease",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

interface HomeNotificationPanelProps {
  notifications: NotificationRecord[];
  onOpenNotification: (n: NotificationRecord) => void | Promise<void>;
}

export function HomeNotificationPanel({
  notifications,
  onOpenNotification,
}: HomeNotificationPanelProps) {
  const [tab, setTab] = useState<Tab>("all");

  const counts = useMemo(
    () =>
      TAB_ORDER.reduce<Record<Tab, number>>(
        (acc, t) => {
          acc[t.id] =
            t.id === "all"
              ? notifications.length
              : notifications.filter((n) => categoryOf(n) === t.id).length;
          return acc;
        },
        { all: 0, tasks: 0, needs_input: 0, alerts: 0 },
      ),
    [notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  const visible = useMemo(() => {
    const items =
      tab === "all" ? notifications : notifications.filter((n) => categoryOf(n) === tab);
    return [...items].sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [tab, notifications]);

  const needsInput = visible.filter((n) => categoryOf(n) === "needs_input");
  const others = visible.filter((n) => categoryOf(n) !== "needs_input");

  const onOpen = (n: NotificationRecord) => {
    void onOpenNotification(n);
  };

  return (
    <aside style={PANEL_STYLE}>
      <div style={HEADER_STYLE}>
        <div style={TITLE_ROW_STYLE}>
          <Bell size={16} color="var(--color-text-secondary)" />
          <h2 style={TITLE_STYLE}>Notifications</h2>
          {unreadCount > 0 ? <UnreadBadge count={unreadCount} /> : null}
        </div>
        <div style={TABS_STYLE}>
          {TAB_ORDER.map((t) => (
            <TabButton
              key={t.id}
              active={tab === t.id}
              label={t.label}
              count={counts[t.id]}
              onClick={() => setTab(t.id)}
            />
          ))}
        </div>
      </div>

      <div style={BODY_STYLE}>
        {visible.length === 0 ? (
          <div style={EMPTY_STYLE}>No notifications here yet.</div>
        ) : (
          <>
            {needsInput.map((n) => (
              <NeedsInputCard key={n.id} notification={n} onOpen={onOpen} />
            ))}
            {others.map((n) => (
              <NotificationRow key={n.id} notification={n} onOpen={onOpen} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

export default HomeNotificationPanel;

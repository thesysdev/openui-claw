"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Cpu,
  EllipsisVertical,
  FileText,
  Home,
  LayoutGrid,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useThreadList } from "@openuidev/react-headless";
import { Shell } from "@openuidev/react-ui";
import { ConnectionState } from "@/lib/gateway/types";
import type { ClawThread } from "@/types/claw-thread";
import {
  useHashRoute,
  navigate,
  appHash,
  homeHash,
} from "@/lib/hooks/useHashRoute";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { NotificationRecord } from "@/lib/notifications";
import { useTheme } from "@/lib/hooks/useTheme";
import { UnreadBadge } from "@/components/ui/UnreadBadge";
import { StatusDot } from "@/components/ui/StatusDot";
import { ThemeModal } from "@/components/ui/ThemeModal";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ExpandCollapse } from "@/components/ui/ExpandCollapse";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "#a1a1aa",
  [ConnectionState.CONNECTING]: "#facc15",
  [ConnectionState.CONNECTED]: "#22c55e",
  [ConnectionState.AUTH_FAILED]: "#ef4444",
  [ConnectionState.PAIRING]: "#f59e0b",
};

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Disconnected",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Connected",
  [ConnectionState.AUTH_FAILED]: "Auth failed",
  [ConnectionState.PAIRING]: "Pairing…",
};

const STATUS_ICON: Record<ConnectionState, typeof Wifi> = {
  [ConnectionState.DISCONNECTED]: WifiOff,
  [ConnectionState.CONNECTING]: Loader2,
  [ConnectionState.CONNECTED]: Wifi,
  [ConnectionState.AUTH_FAILED]: ShieldAlert,
  [ConnectionState.PAIRING]: Loader2,
};

const STATUS_ICON_SPIN: Record<ConnectionState, boolean> = {
  [ConnectionState.DISCONNECTED]: false,
  [ConnectionState.CONNECTING]: true,
  [ConnectionState.CONNECTED]: false,
  [ConnectionState.AUTH_FAILED]: false,
  [ConnectionState.PAIRING]: true,
};

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const PAD_OUTER = "0 var(--sp-s)";
const ROW_PAD = "var(--sp-xs) var(--sp-xs)";

const SEARCH_KBD_STYLE: CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-2xs)",
  fontWeight: "var(--fw-medium)",
  color: "var(--color-text-tertiary)",
  padding: "2px 5px",
  borderRadius: "var(--r-s)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};

const SEPARATOR_STYLE: CSSProperties = {
  height: 1,
  backgroundColor: "var(--color-border)",
  opacity: 0.35,
  margin: "var(--sp-xs) var(--sp-s)",
};

// ── HELPERS ────────────────────────────────────────────────────────────────

type AgentGroup = {
  agentId: string;
  headerTitle: string;
  threads: ClawThread[];
};

function buildAgentGroups(threads: ClawThread[]): AgentGroup[] {
  const map = new Map<string, AgentGroup>();
  for (const t of threads) {
    const aid = t.clawAgentId ?? t.id;
    let g = map.get(aid);
    if (!g) {
      g = { agentId: aid, headerTitle: aid, threads: [] };
      map.set(aid, g);
    }
    if (t.clawKind === "main") g.headerTitle = t.title;
    g.threads.push(t);
  }
  return [...map.values()];
}

function countUnread(
  notifications: NotificationRecord[],
  predicate: (n: NotificationRecord) => boolean,
): number {
  let count = 0;
  for (const n of notifications) if (n.unread && predicate(n)) count++;
  return count;
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function NavSep() {
  return <div style={SEPARATOR_STYLE} aria-hidden />;
}

function SectionHead({
  icon: Icon,
  label,
  open,
  onToggle,
}: {
  icon: typeof Cpu;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-s)",
        padding: ROW_PAD,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: hover ? "var(--color-sunk-light)" : "transparent",
        cursor: "pointer",
        borderRadius: "var(--r-m)",
        marginBottom: "1px",
        transition: "background-color 0.15s",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--r-m)",
          backgroundColor: hover ? "var(--color-sunk-light)" : "var(--color-bg)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={13} color="var(--color-text-accent-primary)" />
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-label)",
          fontSize: "var(--fs-xs)",
          fontWeight: "var(--fw-medium)",
          color: hover ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
          transition: "color 0.15s",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <ChevronDown
        size={11}
        color="var(--color-text-tertiary)"
        style={{
          flexShrink: 0,
          transition: `transform 0.3s ${EASE}`,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }}
      />
    </button>
  );
}

function ViewAllRow({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-s)",
        padding: ROW_PAD,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "var(--r-m)",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--r-m)",
          backgroundColor: "transparent",
          border: `1px solid ${hover ? "var(--color-border-accent)" : "var(--color-border)"}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "border-color 0.15s",
        }}
      >
        <ChevronRight
          size={12}
          color={
            hover ? "var(--color-text-accent-primary)" : "var(--color-text-tertiary)"
          }
        />
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-sm)",
          color: hover ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
          transition: "color 0.15s",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function LetterTile({
  letter,
  state,
}: {
  letter: string;
  state: "idle" | "hover" | "active";
}) {
  const bg =
    state === "active"
      ? "var(--color-highlight-strong)"
      : state === "hover"
        ? "var(--color-sunk-light)"
        : "var(--color-bg)";
  const color =
    state === "active" || state === "hover"
      ? "var(--color-text-primary)"
      : "var(--color-text-tertiary)";
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: "var(--r-m)",
        backgroundColor: bg,
        border: "1px solid var(--color-border)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "var(--font-label)",
        fontSize: "var(--fs-xs)",
        fontWeight: "var(--fw-bold)",
        lineHeight: 1,
        color,
        transition: "background-color 0.15s, box-shadow 0.15s, color 0.15s",
        boxShadow: state === "hover" ? "var(--shadow-lg)" : "none",
      }}
    >
      {letter.charAt(0).toUpperCase()}
    </span>
  );
}

function SessionRow({
  label,
  active,
  hasUnread,
  onClick,
  onDoubleClick,
  menu,
  editingInput,
}: {
  label: string;
  active: boolean;
  hasUnread: boolean;
  onClick?: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  menu?: ReactNode;
  editingInput?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  if (editingInput) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 var(--sp-xs)",
          gap: "var(--sp-s)",
        }}
      >
        <div style={{ width: 24, flexShrink: 0 }} />
        {editingInput}
      </div>
    );
  }
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: 30,
        padding: "0 var(--sp-xs)",
        gap: "var(--sp-s)",
        borderRadius: "var(--r-m)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active ? (
          <CornerDownLeft
            size={11}
            color="var(--color-text-primary)"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-sm)",
          fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
          color: active || hover
            ? "var(--color-text-primary)"
            : "var(--color-text-tertiary)",
          transition: "color 0.15s",
        }}
      >
        {label}
      </button>
      {hasUnread ? <StatusDot size={5} color="var(--color-destructive)" /> : null}
      {menu}
    </div>
  );
}

// ── SMALL STYLE HELPERS ────────────────────────────────────────────────────

const EMPTY_SECTION_STYLE: CSSProperties = {
  padding: "var(--sp-xs) var(--sp-s)",
  fontSize: "var(--fs-xs)",
  color: "var(--color-text-tertiary)",
};

function PILL_ICON_BUTTON_STYLE(tone: "muted" | "accent"): CSSProperties {
  return {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 2,
    color: tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-text-tertiary)",
  };
}

// ── ROW COMPONENTS (prototype-faithful) ────────────────────────────────────

function SearchRow({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-s)",
        padding: ROW_PAD,
        width: "100%",
        textAlign: "left",
        borderRadius: "var(--r-m)",
        background: hover ? "var(--color-sunk)" : "var(--color-sunk-light)",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.15s",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--r-m)",
          backgroundColor: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Search size={12} color="var(--color-text-accent-primary)" />
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-sm)",
          color: "var(--color-text-tertiary)",
        }}
      >
        Search
      </span>
      <span style={SEARCH_KBD_STYLE}>⌘K</span>
    </button>
  );
}

function HomeNavRow({ active, unread }: { active: boolean; unread: number }) {
  const [hover, setHover] = useState(false);
  const hi = active || hover;
  return (
    <a
      href={homeHash()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-s)",
        padding: ROW_PAD,
        width: "100%",
        borderRadius: "var(--r-m)",
        background: active
          ? "var(--color-bg)"
          : hover
            ? "var(--color-sunk-light)"
            : "transparent",
        color: hi ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        textDecoration: "none",
        boxShadow: active ? "var(--shadow-md)" : "none",
        fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
        transition: "background-color 0.15s, box-shadow 0.15s",
        marginBottom: "1px",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "var(--r-m)",
          backgroundColor: active
            ? "var(--color-highlight-strong)"
            : hover
              ? "var(--color-sunk-light)"
              : "var(--color-bg)",
          border: "1px solid var(--color-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background-color 0.15s",
        }}
      >
        <Home
          size={13}
          color="var(--color-text-accent-primary)"
        />
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-sm)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Home
      </span>
      {unread > 0 ? <UnreadBadge count={unread} /> : null}
    </a>
  );
}

function SidebarLetterRow({
  letter,
  label,
  href,
  active,
  onClick,
  right,
}: {
  letter: string;
  label: string;
  href?: string;
  active: boolean;
  onClick?: () => void;
  right?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const state: "idle" | "hover" | "active" = active ? "active" : hover ? "hover" : "idle";
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--sp-s)",
    padding: ROW_PAD,
    width: "100%",
    borderRadius: "var(--r-m)",
    background: active
      ? "var(--color-bg)"
      : hover
        ? "var(--color-sunk-light)"
        : "transparent",
    color: active || hover ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--fs-sm)",
    fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
    border: "none",
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: active ? "var(--shadow-md)" : "none",
    transition: "background-color 0.15s, box-shadow 0.15s",
    marginBottom: "1px",
  };
  const content = (
    <>
      <LetterTile letter={letter} state={state} />
      <span
        style={{
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {right}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={rowStyle}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={rowStyle}
    >
      {content}
    </button>
  );
}

function AgentCard({
  active,
  header,
  children,
}: {
  active: boolean;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: active ? "var(--color-bg)" : "transparent",
        borderRadius: "var(--r-l)",
        marginTop: active ? "var(--sp-s)" : 0,
        marginBottom: active ? "var(--sp-s)" : "1px",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        transition: `background-color 0.15s, margin 0.3s ${EASE}, box-shadow 0.15s`,
      }}
    >
      {header}
      {children}
    </div>
  );
}

function AgentHeaderButton({
  title,
  state,
  unread,
  expanded,
  onClick,
}: {
  title: string;
  state: "idle" | "active";
  unread: number;
  expanded: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const tileState: "idle" | "hover" | "active" =
    state === "active" ? "active" : hover ? "hover" : "idle";
  const hi = state === "active" || hover || expanded;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-s)",
        padding: ROW_PAD,
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: "var(--r-m)",
      }}
    >
      <LetterTile letter={title} state={tileState} />
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-sm)",
          fontWeight: hi ? "var(--fw-medium)" : "var(--fw-regular)",
          color: hi ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
      {unread > 0 ? <StatusDot size={6} color="var(--color-destructive)" /> : null}
      <ChevronDown
        size={11}
        color="var(--color-text-tertiary)"
        style={{
          opacity: hover || expanded ? 0.5 : 0,
          flexShrink: 0,
          transition: `transform 0.3s ${EASE}, opacity 0.2s`,
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        }}
      />
    </button>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

interface Props {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  createSession: (agentId: string) => Promise<string | null>;
  renameSession: (threadId: string, label: string) => Promise<boolean>;
  deleteSession: (threadId: string) => Promise<boolean>;
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  notifications: NotificationRecord[];
  unreadNotificationCount: number;
  pinnedAppIds: Set<string>;
  onTogglePinned: (appId: string) => void;
  onDeleteApp: (appId: string) => Promise<void>;
}

export function AppSidebar({
  connectionState,
  onSettingsClick,
  createSession,
  renameSession,
  deleteSession,
  apps,
  artifacts,
  notifications,
  unreadNotificationCount,
  pinnedAppIds,
  onTogglePinned,
  onDeleteApp,
}: Props) {
  const { threads, isLoadingThreads, selectedThreadId, loadThreads, selectThread } =
    useThreadList();
  const threadsCast = threads as ClawThread[];

  const route = useHashRoute();
  const homeActive = route?.view === "home";
  const activeAppId = route?.view === "app" ? route.appId : null;
  const activeChatId = route?.view === "chat" ? route.sessionId : null;

  const [agentsExpanded, setAgentsExpanded] = useState(true);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [appsExpanded, setAppsExpanded] = useState(true);
  const [artifactsExpanded, setArtifactsExpanded] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Observe the Shell sidebar container width to mirror its collapse state.
  useEffect(() => {
    const container = document.querySelector<HTMLElement>(
      ".openui-shell-sidebar-container",
    );
    if (!container) return;
    const update = () => setSidebarExpanded(container.offsetWidth > 120);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const [titleOverrides, setTitleOverrides] = useState<Map<string, string>>(() => new Map());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const serverThreadIdsKey = useMemo(
    () => threadsCast.map((t) => t.id).join("\u0000"),
    [threadsCast],
  );

  const displayThreads = useMemo<ClawThread[]>(() =>
    threadsCast
      .filter((t) => !deletedIds.has(t.id))
      .map((t) => {
        const override = titleOverrides.get(t.id);
        return override ? { ...t, title: override } : t;
      }),
    [threadsCast, deletedIds, titleOverrides]
  );

  useEffect(() => {
    if (isLoadingThreads) return;
    const serverIds = new Set(
      serverThreadIdsKey.length > 0 ? serverThreadIdsKey.split("\u0000") : [],
    );
    setTitleOverrides((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const id of next.keys()) {
        if (!serverIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setDeletedIds((prev) => {
      const nextValues = [...prev].filter((id) => serverIds.has(id));
      return nextValues.length === prev.size ? prev : new Set(nextValues);
    });
  }, [isLoadingThreads, serverThreadIdsKey]);

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [creatingForAgent, setCreatingForAgent] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      loadThreads();
    }
  }, [connectionState, loadThreads]);

  const groups = useMemo(() => buildAgentGroups(displayThreads), [displayThreads]);
  const groupIdsKey = useMemo(
    () => groups.map((group) => group.agentId).join("\u0000"),
    [groups],
  );

  // Auto-expand the agent whose session is currently active.
  useEffect(() => {
    if (!activeChatId) return;
    const g = groups.find((group) => group.threads.some((t) => t.id === activeChatId));
    if (g) setExpandedAgent(g.agentId);
  }, [activeChatId, groups]);

  useEffect(() => {
    if (!expandedAgent) return;
    const exists = groupIdsKey.split("\u0000").includes(expandedAgent);
    if (!exists) setExpandedAgent(null);
  }, [groupIdsKey, expandedAgent]);

  useEffect(() => {
    if (
      route?.view === "chat" &&
      !isLoadingThreads &&
      displayThreads.length > 0 &&
      !selectedThreadId
    ) {
      selectThread(displayThreads[0].id);
    }
  }, [route, isLoadingThreads, displayThreads, selectedThreadId, selectThread]);

  useEffect(() => {
    if (!isLoadingThreads && pendingSelectRef.current) {
      const id = pendingSelectRef.current;
      if (displayThreads.some((t) => t.id === id)) {
        pendingSelectRef.current = null;
        selectThread(id);
      }
    }
  }, [isLoadingThreads, displayThreads, selectThread]);

  const runAfterRefresh = useCallback(
    (selectId: string) => {
      pendingSelectRef.current = selectId;
      loadThreads();
    },
    [loadThreads]
  );

  const handleNewSession = useCallback(
    async (agentId: string) => {
      setCreatingForAgent(agentId);
      try {
        const id = await createSession(agentId);
        if (id) {
          runAfterRefresh(id);
          navigate({ view: "chat", sessionId: id });
        }
      } finally {
        setCreatingForAgent(null);
      }
    },
    [createSession, runAfterRefresh]
  );

  const startEditing = useCallback((threadId: string, currentTitle: string) => {
    setEditingThreadId(threadId);
    setEditValue(currentTitle);
    requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingThreadId(null);
    setEditValue("");
  }, []);

  const commitRename = useCallback(
    async (threadId: string) => {
      const trimmed = editValue.trim();
      setEditingThreadId(null);
      if (!trimmed) return;

      setRenamingThreadId(threadId);
      try {
        const ok = await renameSession(threadId, trimmed);
        if (ok) {
          setTitleOverrides((prev) => new Map(prev).set(threadId, trimmed));
          loadThreads();
        }
      } finally {
        setRenamingThreadId(null);
      }
    },
    [editValue, renameSession, loadThreads]
  );

  const handleDelete = useCallback(
    async (threadId: string) => {
      setDeletingThreadId(threadId);
      try {
        const ok = await deleteSession(threadId);
        if (ok) {
          setDeletedIds((prev) => new Set(prev).add(threadId));
          if (selectedThreadId === threadId) {
            const next = displayThreads.find((t) => t.id !== threadId);
            if (next) selectThread(next.id);
          }
          loadThreads();
        }
      } finally {
        setDeletingThreadId(null);
      }
    },
    [deleteSession, displayThreads, selectedThreadId, selectThread, loadThreads]
  );

  const pinnedApps = useMemo(
    () => apps.filter((app) => pinnedAppIds.has(app.id)),
    [apps, pinnedAppIds],
  );

  const agentUnread = useCallback(
    (agentId: string) =>
      countUnread(notifications, (n) => n.source?.agentId === agentId),
    [notifications],
  );

  const sessionUnread = useCallback(
    (sessionId: string) =>
      countUnread(
        notifications,
        (n) => n.target.view === "chat" && n.target.sessionId === sessionId,
      ),
    [notifications],
  );

  return (
    <Shell.SidebarContainer>
      <Shell.SidebarHeader />
      <Shell.SidebarSeparator />

      <Shell.SidebarContent>
        <div
          className="flex h-full min-h-0 flex-1 flex-col"
          style={{ overflow: "hidden" }}
        >
          {/* ── Search ── */}
          <div style={{ padding: PAD_OUTER, flexShrink: 0 }}>
            <SearchRow onClick={() => setSearchOpen(true)} />
          </div>

          <NavSep />

          {/* ── Home ── */}
          <div style={{ padding: PAD_OUTER, flexShrink: 0 }}>
            <HomeNavRow
              active={homeActive}
              unread={unreadNotificationCount}
            />
          </div>

          <NavSep />

          {/* ── Scrollable sections ── */}
          <div className="min-h-0 flex-1 overflow-y-auto">

          {pinnedApps.length > 0 && (
            <>
              <div style={{ padding: PAD_OUTER }}>
                <SectionHead
                  icon={Pin}
                  label="Pinned"
                  open={pinnedExpanded}
                  onToggle={() => setPinnedExpanded((prev) => !prev)}
                />
                <ExpandCollapse open={pinnedExpanded}>
                  <div style={{ paddingBottom: 2 }}>
                    {pinnedApps.map((app) => (
                      <SidebarLetterRow
                        key={app.id}
                        letter={app.title}
                        label={app.title}
                        href={appHash(app.id)}
                        active={activeAppId === app.id}
                        onClick={() => navigate({ view: "app", appId: app.id })}
                        right={
                          <button
                            type="button"
                            title="Unpin app"
                            onClick={(e) => {
                              e.preventDefault();
                              onTogglePinned(app.id);
                            }}
                            style={PILL_ICON_BUTTON_STYLE("accent")}
                          >
                            <Pin size={12} />
                          </button>
                        }
                      />
                    ))}
                  </div>
                </ExpandCollapse>
              </div>
              <NavSep />
            </>
          )}

          {/* ── Agents section ── */}
          <div style={{ padding: PAD_OUTER }}>
            <SectionHead
              icon={Cpu}
              label="Agents"
              open={agentsExpanded}
              onToggle={() => setAgentsExpanded((prev) => !prev)}
            />
            <ExpandCollapse open={agentsExpanded} duration={0.4}>
            {isLoadingThreads && displayThreads.length === 0 && (
              <p
                style={{
                  padding: "var(--sp-s) var(--sp-m)",
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Loading agents…
              </p>
            )}
            <div style={{ paddingBottom: 2 }}>
              {groups.slice(0, 3).map((g) => {
                const expanded = expandedAgent === g.agentId;
                const unread = agentUnread(g.agentId);
                const isActive = g.threads.some((t) => t.id === activeChatId);
                const cardActive = expanded || isActive;
                return (
                  <AgentCard
                    key={g.agentId}
                    active={cardActive}
                    header={
                      <AgentHeaderButton
                        title={g.headerTitle}
                        state={cardActive ? "active" : "idle"}
                        unread={unread}
                        expanded={expanded}
                        onClick={() =>
                          setExpandedAgent((prev) => (prev === g.agentId ? null : g.agentId))
                        }
                      />
                    }
                  >
                    <ExpandCollapse open={expanded} duration={0.3}>
                      <div style={{ padding: "2px var(--sp-s) var(--sp-s)" }}>
                        {g.threads.map((t) => {
                          const isEditing = editingThreadId === t.id;
                          const isRenaming = renamingThreadId === t.id;
                          const isDeleting = deletingThreadId === t.id;
                          const isExtra = t.clawKind !== "main";
                          const isBusy = isRenaming || isDeleting;
                          const label = isDeleting
                            ? "Deleting…"
                            : isRenaming
                              ? "Renaming…"
                              : isExtra
                                ? t.title
                                : "Main";
                          const unread = sessionUnread(t.id);
                          return (
                            <SessionRow
                              key={t.id}
                              label={label}
                              active={activeChatId === t.id}
                              hasUnread={unread > 0}
                              isMain={!isExtra}
                              onClick={() => {
                                selectThread(t.id);
                                navigate({ view: "chat", sessionId: t.id });
                              }}
                              onDoubleClick={
                                isExtra && !isBusy
                                  ? (e) => {
                                      e.preventDefault();
                                      startEditing(t.id, t.title);
                                    }
                                  : undefined
                              }
                              editingInput={
                                isEditing ? (
                                  <input
                                    ref={editInputRef}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        commitRename(t.id);
                                      } else if (e.key === "Escape") {
                                        cancelEditing();
                                      }
                                    }}
                                    onBlur={() => commitRename(t.id)}
                                    maxLength={64}
                                    style={{
                                      flex: 1,
                                      background: "transparent",
                                      border: "none",
                                      outline: "none",
                                      fontSize: "var(--fs-xs)",
                                      color: "var(--color-text-primary)",
                                      fontFamily: "var(--font-body)",
                                    }}
                                  />
                                ) : undefined
                              }
                              menu={
                                isExtra && !isBusy && !isEditing ? (
                                  <DropdownMenu.Root>
                                    <DropdownMenu.Trigger asChild>
                                      <button
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          cursor: "pointer",
                                          padding: 2,
                                          color: "var(--color-text-tertiary)",
                                        }}
                                      >
                                        <EllipsisVertical size={12} />
                                      </button>
                                    </DropdownMenu.Trigger>
                                    <DropdownMenu.Portal>
                                      <DropdownMenu.Content
                                        className="openui-shell-thread-button-dropdown-menu"
                                        side="bottom"
                                        align="start"
                                        sideOffset={2}
                                      >
                                        <DropdownMenu.Item
                                          className="openui-shell-thread-button-dropdown-menu-item"
                                          onSelect={() => startEditing(t.id, t.title)}
                                        >
                                          <Pencil size={14} className="openui-shell-thread-button-dropdown-menu-item-icon" />
                                          Rename
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                          className="openui-shell-thread-button-dropdown-menu-item"
                                          onSelect={() => handleDelete(t.id)}
                                        >
                                          <Trash2 size={14} className="openui-shell-thread-button-dropdown-menu-item-icon" />
                                          Delete
                                        </DropdownMenu.Item>
                                      </DropdownMenu.Content>
                                    </DropdownMenu.Portal>
                                  </DropdownMenu.Root>
                                ) : undefined
                              }
                            />
                          );
                        })}
                        <button
                          type="button"
                          disabled={creatingForAgent === g.agentId}
                          onClick={() => handleNewSession(g.agentId)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--sp-xs)",
                            padding: "var(--sp-2xs) var(--sp-xs)",
                            fontFamily: "var(--font-label)",
                            fontSize: "var(--fs-xs)",
                            color: "var(--color-text-tertiary)",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            borderRadius: "var(--r-m)",
                            width: "100%",
                            textAlign: "left",
                          }}
                        >
                          <Plus size={12} />
                          {creatingForAgent === g.agentId ? "Creating…" : "New session"}
                        </button>
                      </div>
                    </ExpandCollapse>
                  </AgentCard>
                );
              })}
              <ViewAllRow
                label="View all"
                onClick={() => {
                  /* placeholder: no dedicated agents-list view yet */
                }}
              />
            </div>
            </ExpandCollapse>
          </div>

          <NavSep />

          {/* ── Apps section ── */}
          <div style={{ padding: PAD_OUTER }}>
            <SectionHead
              icon={LayoutGrid}
              label="Apps"
              open={appsExpanded}
              onToggle={() => setAppsExpanded((prev) => !prev)}
            />
            <ExpandCollapse open={appsExpanded}>
              <div style={{ paddingBottom: 2 }}>
                {apps.length === 0 ? (
                  <p style={EMPTY_SECTION_STYLE}>No apps yet</p>
                ) : (
                  apps.slice(0, 3).map((app) => {
                    const isActive = activeAppId === app.id;
                    const isDeleting = deletingAppId === app.id;
                    const isPinned = pinnedAppIds.has(app.id);
                    return (
                      <SidebarLetterRow
                        key={app.id}
                        letter={app.title}
                        label={isDeleting ? "Deleting…" : app.title}
                        href={appHash(app.id)}
                        active={isActive}
                        onClick={() => navigate({ view: "app", appId: app.id })}
                        right={
                          !isDeleting ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                              <button
                                type="button"
                                title={isPinned ? "Unpin app" : "Pin app"}
                                onClick={(e) => {
                                  e.preventDefault();
                                  onTogglePinned(app.id);
                                }}
                                style={PILL_ICON_BUTTON_STYLE(isPinned ? "accent" : "muted")}
                              >
                                <Pin size={12} />
                              </button>
                              <button
                                type="button"
                                title="Delete app"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  setDeletingAppId(app.id);
                                  try {
                                    await onDeleteApp(app.id);
                                    if (isActive) navigate({ view: "home" });
                                  } finally {
                                    setDeletingAppId(null);
                                  }
                                }}
                                style={PILL_ICON_BUTTON_STYLE("muted")}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : undefined
                        }
                      />
                    );
                  })
                )}
                <ViewAllRow
                  label="View all"
                  onClick={() => navigate({ view: "home" })}
                />
              </div>
            </ExpandCollapse>
          </div>

          <NavSep />

          {/* ── Artifacts section ── */}
          <div style={{ padding: PAD_OUTER }}>
            <SectionHead
              icon={FileText}
              label="Artifacts"
              open={artifactsExpanded}
              onToggle={() => setArtifactsExpanded((prev) => !prev)}
            />
            <ExpandCollapse open={artifactsExpanded}>
              <div style={{ paddingBottom: 2 }}>
                {artifacts.length === 0 ? (
                  <p style={EMPTY_SECTION_STYLE}>No artifacts yet</p>
                ) : (
                  artifacts.slice(0, 3).map((artifact) => (
                    <SidebarLetterRow
                      key={artifact.id}
                      letter={artifact.title}
                      label={artifact.title}
                      active={route?.view === "artifact" && route.artifactId === artifact.id}
                      onClick={() => navigate({ view: "artifact", artifactId: artifact.id })}
                    />
                  ))
                )}
                <ViewAllRow
                  label="View all"
                  onClick={() => navigate({ view: "artifacts" })}
                />
              </div>
            </ExpandCollapse>
          </div>
          </div>
        </div>
      </Shell.SidebarContent>

      {/* ── Bottom bar: status (+ theme + settings when expanded) ── */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-s)",
          borderTop: "1px solid var(--color-border)",
          padding: "var(--sp-m) var(--sp-m)",
          justifyContent: sidebarExpanded ? "flex-start" : "center",
        }}
      >
        <StatusIcon state={connectionState} />
        {sidebarExpanded ? (
          <>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-xs)",
                color: "var(--color-text-secondary)",
              }}
            >
              {STATUS_LABEL[connectionState]}
            </span>
            <ThemeIconButton onClick={() => setThemeOpen(true)} />
            <IconButton onClick={onSettingsClick} title="Open settings">
              <Settings size={14} />
            </IconButton>
          </>
        ) : null}
      </div>

      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        threads={displayThreads}
        apps={apps}
        artifacts={artifacts}
        onSelect={(href) => {
          window.location.hash = href.replace(/^#/, "");
        }}
      />
    </Shell.SidebarContainer>
  );
}

function StatusIcon({ state }: { state: ConnectionState }) {
  const Icon = STATUS_ICON[state];
  const spin = STATUS_ICON_SPIN[state];
  return (
    <Icon
      size={14}
      color={STATUS_COLORS[state]}
      className={spin ? "animate-spin" : undefined}
      aria-label={STATUS_LABEL[state]}
      style={{ flexShrink: 0 }}
    />
  );
}

function ThemeIconButton({ onClick }: { onClick: () => void }) {
  const { palette, mode } = useTheme();
  const title = `Theme: ${palette === "bloom" ? "Bloom" : "Neo"} · ${mode === "dark" ? "Dark" : "Light"}`;
  return (
    <IconButton onClick={onClick} title={title}>
      <Sparkles size={14} />
    </IconButton>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={title}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "var(--r-m)",
        background: hover ? "var(--color-sunk-light)" : "transparent",
        color: "var(--color-text-tertiary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

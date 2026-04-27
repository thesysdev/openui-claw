"use client";

import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";
import {
  agentsHash,
  appHash,
  appsHash,
  artifactHash,
  artifactsHash,
  cronsHash,
  homeHash,
  navigate,
  skillsHash,
  useHashRoute,
} from "@/lib/hooks/useHashRoute";
import type { ClawThread } from "@/types/claw-thread";
import { useThreadList } from "@openuidev/react-headless";
import {
  BookOpen,
  ChevronRight,
  Clock3,
  Cpu,
  FileText,
  Home,
  LayoutGrid,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { togglePinnedThread, usePinnedThreadIds } from "@/lib/session-pins";
import { AgentTab } from "./sidebar/AgentTab";
import { ExpandCollapse } from "./sidebar/ExpandCollapse";
import { IconButton } from "./sidebar/IconButton";
import { Logo } from "./sidebar/Logo";
import { NavTab, UnreadBadge } from "./sidebar/NavTab";
import { SectionSeparator } from "./sidebar/Separator";
import { SectionTab } from "./sidebar/SectionTab";
import { SessionRow } from "./sidebar/SessionRow";
import { Tag } from "./sidebar/Tag";
import { BorderTile, CategoryTile, IconTile, TextTile } from "./sidebar/Tile";

// ─── Connection status styling ───────────────────────────────────────────────

const DOT_CLASS: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "bg-status-muted",
  [ConnectionState.CONNECTING]: "bg-status-warning animate-pulse",
  [ConnectionState.CONNECTED]: "bg-status-online",
  [ConnectionState.AUTH_FAILED]: "bg-status-error",
  [ConnectionState.PAIRING]: "bg-status-warning animate-pulse",
};

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Disconnected",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Connected",
  [ConnectionState.AUTH_FAILED]: "Auth failed",
  [ConnectionState.PAIRING]: "Pairing…",
};

// ─── Agent grouping ──────────────────────────────────────────────────────────

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

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  createSession: (agentId: string) => Promise<string | null>;
  renameSession: (threadId: string, label: string) => Promise<boolean>;
  deleteSession: (threadId: string) => Promise<boolean>;
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  unreadNotificationCount: number;
  hiddenThreadIds?: Set<string>;
  pinnedAppIds: Set<string>;
  onOpenCommandPalette?: () => void;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AppSidebar({
  connectionState,
  onSettingsClick,
  createSession,
  renameSession,
  deleteSession,
  apps,
  artifacts,
  unreadNotificationCount,
  hiddenThreadIds = new Set(),
  pinnedAppIds,
  onOpenCommandPalette,
}: Props) {
  // ── Data hooks ──
  const {
    threads,
    isLoadingThreads,
    selectedThreadId,
    loadThreads,
    selectThread,
  } = useThreadList();
  const threadsCast = threads as ClawThread[];

  const route = useHashRoute();
  const homeActive = route?.view === "home";
  const activeAppId = route?.view === "app" ? route.appId : null;
  const activeChatId = route?.view === "chat" ? route.sessionId : null;

  // ── Local state ──
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return next;
    });
  }, []);
  const [sectionsOpen, setSectionsOpen] = useState({
    agents: true,
    apps: true,
    artifacts: true,
  });
  const toggleSection = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);

  const pinnedThreadIds = usePinnedThreadIds();
  const [titleOverrides, setTitleOverrides] = useState<Map<string, string>>(() => new Map());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const [creatingForAgent, setCreatingForAgent] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelectRef = useRef<string | null>(null);

  const serverThreadIdsKey = useMemo(
    () => threadsCast.map((t) => t.id).join("\u0000"),
    [threadsCast],
  );

  const displayThreads = useMemo<ClawThread[]>(
    () =>
      threadsCast
        .filter((t) => !deletedIds.has(t.id) && !hiddenThreadIds.has(t.id))
        .map((t) => {
          const override = titleOverrides.get(t.id);
          return override ? { ...t, title: override } : t;
        }),
    [threadsCast, deletedIds, hiddenThreadIds, titleOverrides],
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

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      loadThreads();
    }
  }, [connectionState, loadThreads]);

  const groups = useMemo(() => buildAgentGroups(displayThreads), [displayThreads]);

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

  // Auto-expand the active agent; collapse when the active view is elsewhere.
  useEffect(() => {
    if (route?.view === "chat" && activeChatId) {
      const match = displayThreads.find((t) => t.id === activeChatId);
      if (match?.clawAgentId) {
        setExpandedAgent(match.clawAgentId);
        return;
      }
    }
    setExpandedAgent(null);
  }, [route?.view, activeChatId, displayThreads]);

  // ── Handlers ──
  const runAfterRefresh = useCallback(
    (selectId: string) => {
      pendingSelectRef.current = selectId;
      loadThreads();
    },
    [loadThreads],
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
    [createSession, runAfterRefresh],
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
    [editValue, renameSession, loadThreads],
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
    [deleteSession, displayThreads, selectedThreadId, selectThread, loadThreads],
  );

  /** Apps sorted by recency (pinned first, then by updatedAt desc). */
  const sortedApps = useMemo(() => {
    const pinRank = (id: string) => (pinnedAppIds.has(id) ? 1 : 0);
    return [...apps].sort((a, b) => {
      const pin = pinRank(b.id) - pinRank(a.id);
      if (pin !== 0) return pin;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [apps, pinnedAppIds]);

  /** Artifacts sorted by updatedAt desc. */
  const sortedArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [artifacts],
  );

  /** Agent groups sorted by most-recent thread createdAt desc. */
  const recentGroups = useMemo(() => {
    const latestCreatedAt = (threads: ClawThread[]): string =>
      threads.reduce<string>(
        (latest, t) => (String(t.createdAt) > latest ? String(t.createdAt) : latest),
        "",
      );
    return [...groups].sort((a, b) =>
      latestCreatedAt(b.threads).localeCompare(latestCreatedAt(a.threads)),
    );
  }, [groups]);

  const openSearch = useCallback(() => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
      return;
    }
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }, [onOpenCommandPalette]);

  const nc = navCollapsed;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border-default/50 dark:border-border-default/16 bg-foreground dark:bg-sunk-deep"
      style={{
        width: nc ? 48 : 260,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── Header: logo + collapse ── */}
      <div
        className={`flex h-[48px] items-center border-b border-border-default/40 dark:border-border-default/16 ${
          nc ? "justify-center px-0" : "justify-between px-ml"
        } transition-[padding] duration-300`}
      >
        <Logo name="OpenUI" suffix="shell" collapsed={nc} />
        <IconButton
          icon={nc ? PanelLeft : PanelLeftClose}
          variant="tertiary"
          size="md"
          title={nc ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setNavCollapsed(!nc)}
        />
      </div>

      {/* ── Search ── */}
      <div className={`pt-m ${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
        <NavTab
          tile={<IconTile icon={Search} />}
          label="Search"
          hovered={hov === "search"}
          collapsed={nc}
          onClick={openSearch}
          onMouseEnter={() => setHov("search")}
          onMouseLeave={() => setHov(null)}
          title="Search"
          trailing={<Tag size="sm" variant="neutral">⌘K</Tag>}
        />
      </div>

      {/* ── Home ── */}
      <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
        <NavTab
          tile={<IconTile icon={Home} />}
          label="Home"
          href={homeHash()}
          active={homeActive}
          hovered={hov === "home"}
          collapsed={nc}
          onClick={() => navigate({ view: "home" })}
          onMouseEnter={() => setHov("home")}
          onMouseLeave={() => setHov(null)}
          trailing={<UnreadBadge count={unreadNotificationCount} />}
          title="Home"
        />
      </div>

      <SectionSeparator />

      {/* ── Scrollable middle: agents, apps, artifacts ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Agents */}
        <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
          <SectionTab
            category="agents"
            icon={Cpu}
            label="Agents"
            open={sectionsOpen.agents}
            hovered={hov === "agents-head"}
            collapsed={nc}
            onClick={() => toggleSection("agents")}
            onMouseEnter={() => setHov("agents-head")}
            onMouseLeave={() => setHov(null)}
          />
          <ExpandCollapse open={sectionsOpen.agents} duration={0.4}>
            <div className="pb-3xs">
              {isLoadingThreads && groups.length === 0 ? (
                <p className="px-s py-xs text-xs text-text-neutral-tertiary">
                  Loading agents…
                </p>
              ) : recentGroups.length === 0 ? (
                nc ? null : (
                  <div className="mx-s my-xs rounded-m border border-dashed border-border-default/70 px-s py-xl text-center text-sm text-text-neutral-tertiary dark:border-border-default">
                    No agents yet
                  </div>
                )
              ) : (
                recentGroups.slice(0, 5).map((g) => {
                  const isActiveAgent = g.threads.some((t) => t.id === activeChatId);
                  const isExpanded = expandedAgent === g.agentId;
                  const isH = hov === g.agentId;
                  const sessions = g.threads;
                  const main = sessions.find((t) => t.clawKind === "main");
                  const extras = sessions.filter((t) => t.clawKind !== "main");
                  // Pinned extras float above unpinned. Order is stable
                  // within each bucket so the user's mental model
                  // (recency) is preserved.
                  const pinnedExtras = extras.filter((t) => pinnedThreadIds.has(t.id));
                  const unpinnedExtras = extras.filter((t) => !pinnedThreadIds.has(t.id));
                  const ordered = main
                    ? [main, ...pinnedExtras, ...unpinnedExtras]
                    : [...pinnedExtras, ...unpinnedExtras];

                  return (
                    <AgentTab
                      key={g.agentId}
                      name={g.headerTitle}
                      active={isActiveAgent}
                      hovered={isH}
                      expanded={isExpanded}
                      collapsed={nc}
                      hasSessions={sessions.length > 0}
                      onMouseEnter={() => setHov(g.agentId)}
                      onMouseLeave={() => setHov(null)}
                      onToggle={() => {
                        if (isExpanded) {
                          setExpandedAgent(null);
                        } else {
                          setExpandedAgent(g.agentId);
                          if (main) {
                            selectThread(main.id);
                            navigate({ view: "chat", sessionId: main.id });
                          }
                        }
                      }}
                      onNewSession={() => handleNewSession(g.agentId)}
                      creating={creatingForAgent === g.agentId}
                    >
                      {ordered.map((t) => {
                        const isEditing = editingThreadId === t.id;
                        const isRenaming = renamingThreadId === t.id;
                        const isDeleting = deletingThreadId === t.id;
                        const isExtra = t.clawKind !== "main";
                        const busy = isRenaming || isDeleting;
                        const sesActive = activeChatId === t.id;
                        const sesHov = hov === `ses-${t.id}`;
                        const label = isDeleting
                          ? "Deleting…"
                          : isRenaming
                            ? "Renaming…"
                            : isExtra
                              ? t.title
                              : "Main";
                        return (
                          <SessionRow
                            key={t.id}
                            ref={isEditing ? editInputRef : undefined}
                            label={label}
                            active={sesActive}
                            hovered={sesHov}
                            isExtra={isExtra}
                            busy={busy}
                            editing={isEditing}
                            editValue={editValue}
                            onEditChange={setEditValue}
                            onEditCommit={() => commitRename(t.id)}
                            onEditCancel={cancelEditing}
                            onClick={() => {
                              selectThread(t.id);
                              navigate({ view: "chat", sessionId: t.id });
                            }}
                            onDoubleClick={() => startEditing(t.id, t.title)}
                            onMouseEnter={() => setHov(`ses-${t.id}`)}
                            onMouseLeave={() => setHov(null)}
                            onRename={() => startEditing(t.id, t.title)}
                            onDelete={() => handleDelete(t.id)}
                            pinned={pinnedThreadIds.has(t.id)}
                            onTogglePin={isExtra ? () => togglePinnedThread(t.id) : undefined}
                          />
                        );
                      })}
                    </AgentTab>
                  );
                })
              )}
              {recentGroups.length > 5 ? (
                <NavTab
                  tile={<BorderTile icon={ChevronRight} hover={hov === "agents-viewall"} />}
                  label="View all"
                  muted
                  active={route?.view === "agents"}
                  hovered={hov === "agents-viewall"}
                  collapsed={nc}
                  onClick={() => navigate({ view: "agents" })}
                  onMouseEnter={() => setHov("agents-viewall")}
                  onMouseLeave={() => setHov(null)}
                  href={agentsHash()}
                />
              ) : null}
            </div>
          </ExpandCollapse>
        </div>

        <SectionSeparator />

        {/* Apps */}
        <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
          <SectionTab
            category="apps"
            icon={LayoutGrid}
            label="Apps"
            open={sectionsOpen.apps}
            hovered={hov === "apps-head"}
            collapsed={nc}
            onClick={() => toggleSection("apps")}
            onMouseEnter={() => setHov("apps-head")}
            onMouseLeave={() => setHov(null)}
          />
          <ExpandCollapse open={sectionsOpen.apps} duration={0.3}>
            <div className="pb-3xs">
              {sortedApps.length === 0 ? (
                nc ? null : (
                  <div className="mx-s my-xs rounded-m border border-dashed border-border-default/70 px-s py-xl text-center text-sm text-text-neutral-tertiary dark:border-border-default">
                    No apps built yet
                  </div>
                )
              ) : (
                sortedApps.slice(0, 5).map((app) => {
                  const id = `app-${app.id}`;
                  const isActive = activeAppId === app.id;
                  const isH = hov === id;
                  return (
                    <NavTab
                      key={app.id}
                      tile={<TextTile label={app.title} active={isActive} hover={isH} category={isActive ? "apps" : null} />}
                      label={app.title}
                      href={appHash(app.id)}
                      active={isActive}
                      hovered={isH}
                      collapsed={nc}
                      onClick={() => navigate({ view: "app", appId: app.id })}
                      onMouseEnter={() => setHov(id)}
                      onMouseLeave={() => setHov(null)}
                    />
                  );
                })
              )}
              {sortedApps.length > 5 ? (
                <NavTab
                  tile={<BorderTile icon={ChevronRight} hover={hov === "apps-viewall"} />}
                  label="View all"
                  muted
                  active={route?.view === "apps"}
                  hovered={hov === "apps-viewall"}
                  collapsed={nc}
                  onClick={() => navigate({ view: "apps" })}
                  onMouseEnter={() => setHov("apps-viewall")}
                  onMouseLeave={() => setHov(null)}
                  href={appsHash()}
                />
              ) : null}
            </div>
          </ExpandCollapse>
        </div>

        <SectionSeparator />

        {/* Artifacts */}
        <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
          <SectionTab
            category="artifacts"
            icon={FileText}
            label="Artifacts"
            open={sectionsOpen.artifacts}
            hovered={hov === "artifacts-head"}
            collapsed={nc}
            onClick={() => toggleSection("artifacts")}
            onMouseEnter={() => setHov("artifacts-head")}
            onMouseLeave={() => setHov(null)}
          />
          <ExpandCollapse open={sectionsOpen.artifacts} duration={0.3}>
            <div className="pb-3xs">
              {artifacts.length === 0 ? (
                nc ? null : (
                  <div className="mx-s my-xs rounded-m border border-dashed border-border-default/70 px-s py-xl text-center text-sm text-text-neutral-tertiary dark:border-border-default">
                    No artifacts created yet
                  </div>
                )
              ) : (
                sortedArtifacts.slice(0, 5).map((a) => {
                  const id = `art-${a.id}`;
                  const isActive = route?.view === "artifact" && route.artifactId === a.id;
                  const isH = hov === id;
                  return (
                    <NavTab
                      key={a.id}
                      tile={<TextTile label={a.title} active={isActive} hover={isH} category={isActive ? "artifacts" : null} />}
                      label={a.title}
                      href={artifactHash(a.id)}
                      active={isActive}
                      hovered={isH}
                      collapsed={nc}
                      onClick={() => navigate({ view: "artifact", artifactId: a.id })}
                      onMouseEnter={() => setHov(id)}
                      onMouseLeave={() => setHov(null)}
                      trailing={
                        <Tag size="sm" variant="neutral" className="uppercase tracking-wide">
                          {a.kind}
                        </Tag>
                      }
                    />
                  );
                })
              )}
              {sortedArtifacts.length > 5 ? (
                <NavTab
                  tile={<BorderTile icon={ChevronRight} hover={hov === "artifacts-viewall"} />}
                  label="View all"
                  muted
                  active={route?.view === "artifacts"}
                  hovered={hov === "artifacts-viewall"}
                  collapsed={nc}
                  onClick={() => navigate({ view: "artifacts" })}
                  onMouseEnter={() => setHov("artifacts-viewall")}
                  onMouseLeave={() => setHov(null)}
                  href={artifactsHash()}
                />
              ) : null}
            </div>
          </ExpandCollapse>
        </div>

        <SectionSeparator />

        {/* Cron Jobs (top-level nav tab sitting with the scrollable list) */}
        <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
          <NavTab
            tile={<IconTile icon={Clock3} />}
            label="Cron Jobs"
            href={cronsHash()}
            active={route?.view === "crons"}
            hovered={hov === "crons"}
            collapsed={nc}
            onClick={() => navigate({ view: "crons" })}
            onMouseEnter={() => setHov("crons")}
            onMouseLeave={() => setHov(null)}
            title="Cron Jobs"
          />
        </div>

        <div className={`${nc ? "px-2xs" : "px-s"} transition-[padding] duration-300`}>
          <NavTab
            tile={<IconTile icon={BookOpen} />}
            label="Skills"
            href={skillsHash()}
            active={route?.view === "skills"}
            hovered={hov === "skills"}
            collapsed={nc}
            onClick={() => navigate({ view: "skills" })}
            onMouseEnter={() => setHov("skills")}
            onMouseLeave={() => setHov(null)}
            title="Skills"
          />
        </div>
      </div>

      {/* ── Footer: connection + theme toggle + settings ── */}
      <div
        className={`flex items-center ${
          nc ? "justify-center" : "justify-between"
        } bg-sunk-light/60 px-m py-sm`}
      >
        {nc ? (
          <IconButton
            icon={Settings}
            variant="tertiary"
            size="md"
            title="Open settings"
            onClick={onSettingsClick}
          />
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-s">
              <span
                className={`inline-block h-s w-s shrink-0 rounded-full ${DOT_CLASS[connectionState]}`}
              />
              <span className="truncate text-xs text-text-neutral-tertiary">
                {STATUS_LABEL[connectionState]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2xs">
              <IconButton
                icon={isDark ? Sun : Moon}
                variant="tertiary"
                size="md"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleDark}
              />
              <IconButton
                icon={Settings}
                variant="tertiary"
                size="md"
                title="Open settings"
                onClick={onSettingsClick}
              />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

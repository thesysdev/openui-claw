"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, EllipsisVertical, Archive, LayoutDashboard, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useThreadList } from "@openuidev/react-headless";
import { Button, Shell } from "@openuidev/react-ui";
import { ConnectionState } from "@/lib/gateway/types";
import type { ClawThread } from "@/types/claw-thread";
import { useHashRoute, navigate, artifactsHash, appHash } from "@/lib/hooks/useHashRoute";
import type { AppSummary } from "@/lib/engines/types";

const DOT_CLASS: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "bg-zinc-400",
  [ConnectionState.CONNECTING]: "bg-yellow-400 animate-pulse",
  [ConnectionState.CONNECTED]: "bg-green-400",
  [ConnectionState.AUTH_FAILED]: "bg-red-500",
  [ConnectionState.PAIRING]: "bg-amber-400 animate-pulse",
};

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Disconnected",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Connected",
  [ConnectionState.AUTH_FAILED]: "Auth failed",
  [ConnectionState.PAIRING]: "Pairing…",
};

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

interface Props {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  createSession: (agentId: string) => Promise<string | null>;
  renameSession: (threadId: string, label: string) => Promise<boolean>;
  deleteSession: (threadId: string) => Promise<boolean>;
  apps: AppSummary[];
  onDeleteApp: (appId: string) => Promise<void>;
}

export function AppSidebar({
  connectionState,
  onSettingsClick,
  createSession,
  renameSession,
  deleteSession,
  apps,
  onDeleteApp,
}: Props) {
  const { threads, isLoadingThreads, selectedThreadId, loadThreads, selectThread } =
    useThreadList();
  const threadsCast = threads as ClawThread[];

  const route = useHashRoute();
  const artifactsActive = route?.view === "artifacts" || route?.view === "artifact";
  const activeAppId = route?.view === "app" ? route.appId : null;

  const [appsExpanded, setAppsExpanded] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);

  const [titleOverrides, setTitleOverrides] = useState<Map<string, string>>(() => new Map());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());

  const displayThreads = useMemo<ClawThread[]>(() =>
    threadsCast
      .filter((t) => !deletedIds.has(t.id))
      .map((t) => {
        const override = titleOverrides.get(t.id);
        return override ? { ...t, title: override } : t;
      }),
    [threadsCast, deletedIds, titleOverrides]
  );

  // Clear stale local overrides/deletions when server data refreshes
  useEffect(() => {
    if (isLoadingThreads) return;
    const serverIds = new Set(threadsCast.map((t) => t.id));
    setTitleOverrides((prev) => {
      const next = new Map(prev);
      for (const id of next.keys()) if (!serverIds.has(id)) next.delete(id);
      return next.size === prev.size ? prev : next;
    });
    setDeletedIds((prev) => {
      const next = new Set([...prev].filter((id) => serverIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [isLoadingThreads, threadsCast]);

  const [expandedByAgent, setExpandedByAgent] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    setExpandedByAgent((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.agentId] === undefined) {
          next[g.agentId] = true;
        }
      }
      return next;
    });
  }, [groups]);

  useEffect(() => {
    if (!isLoadingThreads && displayThreads.length > 0 && !selectedThreadId && !artifactsActive && !activeAppId) {
      selectThread(displayThreads[0].id);
    }
  }, [isLoadingThreads, displayThreads, selectedThreadId, selectThread, artifactsActive, activeAppId]);

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

  return (
    <Shell.SidebarContainer>
      <Shell.SidebarHeader />
      <Shell.SidebarSeparator />

      <Shell.SidebarContent>
        <a
          href={artifactsHash()}
          className={`mx-1 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            artifactsActive
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900/40 dark:hover:text-zinc-300"
          }`}
        >
          <Archive className="h-3.5 w-3.5 shrink-0" />
          Artifacts
        </a>

        {/* ── Apps section ── */}
        <div className="mb-3 px-1">
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-semibold leading-snug tracking-tight text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/40"
            onClick={() => setAppsExpanded((prev) => !prev)}
          >
            <ChevronRight
              className={`h-3 w-3 flex-shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${appsExpanded ? "rotate-90" : ""}`}
            />
            <LayoutDashboard className="h-3 w-3 shrink-0" />
            <span className="truncate">Apps</span>
          </button>

          {appsExpanded && (
            <div className="ml-1.5 mt-1 border-l border-zinc-200 pl-2.5 dark:border-zinc-700">
              {apps.length === 0 ? (
                <p className="py-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  No apps yet
                </p>
              ) : (
                <div className="space-y-0.5">
                  {apps.map((app) => {
                    const isActive = activeAppId === app.id;
                    const isDeleting = deletingAppId === app.id;
                    return (
                      <div
                        key={app.id}
                        className={`openui-shell-thread-button${isActive ? " openui-shell-thread-button--selected" : ""}`}
                      >
                        <a
                          href={appHash(app.id)}
                          className="openui-shell-thread-button-title"
                          onClick={() => navigate({ view: "app", appId: app.id })}
                        >
                          {isDeleting ? "Deleting…" : app.title}
                        </a>
                        {!isDeleting && (
                          <button
                            className="openui-shell-thread-button-dropdown-trigger"
                            title="Delete app"
                            onClick={async (e) => {
                              e.preventDefault();
                              setDeletingAppId(app.id);
                              try {
                                await onDeleteApp(app.id);
                                if (isActive) navigate({ view: "chat", sessionId: "" });
                              } finally {
                                setDeletingAppId(null);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {isLoadingThreads && displayThreads.length === 0 && (
          <p className="px-3 py-2 text-xs text-zinc-400">Loading agents…</p>
        )}
        {groups.map((g) => {
          const expanded = expandedByAgent[g.agentId] !== false;
          return (
            <div key={g.agentId} className="mb-3 px-1">
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-semibold leading-snug tracking-tight text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/40"
                onClick={() =>
                  setExpandedByAgent((prev) => {
                    const isOpen = prev[g.agentId] !== false;
                    return { ...prev, [g.agentId]: !isOpen };
                  })
                }
              >
                <ChevronRight
                  className={`h-3 w-3 flex-shrink-0 text-zinc-400 transition-transform dark:text-zinc-500 ${expanded ? "rotate-90" : ""}`}
                />
                <span className="truncate">{g.headerTitle}</span>
              </button>

              {expanded && (
                <div className="ml-1.5 mt-1 space-y-0.5 border-l border-zinc-200 pl-2.5 dark:border-zinc-700">
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

                    return (
                      <div
                        key={t.id}
                        className={`openui-shell-thread-button${!artifactsActive && selectedThreadId === t.id ? " openui-shell-thread-button--selected" : ""}`}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            className="openui-shell-thread-button-title w-full bg-transparent outline-none"
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
                          />
                        ) : (
                          <>
                            <button
                              type="button"
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
                              className="openui-shell-thread-button-title"
                            >
                              {label}
                            </button>

                            {isExtra && !isBusy && (
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button className="openui-shell-thread-button-dropdown-trigger">
                                    <EllipsisVertical size={14} />
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
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}


                  <Button
                    type="button"
                    variant="tertiary"
                    size="extra-small"
                    disabled={creatingForAgent === g.agentId}
                    iconLeft={<Plus className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />}
                    className="mt-1 w-full justify-start gap-1.5 px-1 font-normal"
                    onClick={() => handleNewSession(g.agentId)}
                  >
                    {creatingForAgent === g.agentId ? "Creating…" : "New session"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Shell.SidebarContent>

      <div className="mt-auto flex items-center gap-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <span
          className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${DOT_CLASS[connectionState]}`}
        />
        <span className="flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {STATUS_LABEL[connectionState]}
        </span>
        <button
          onClick={onSettingsClick}
          title="Open settings"
          className="rounded p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Settings className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </div>
    </Shell.SidebarContainer>
  );
}

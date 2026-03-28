"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Plus, Settings } from "lucide-react";
import { useThreadList } from "@openuidev/react-headless";
import { Button, Shell } from "@openuidev/react-ui";
import { ConnectionState } from "@/lib/gateway/types";
import type { ClawThread } from "@/types/claw-thread";

const DOT_CLASS: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "bg-zinc-400",
  [ConnectionState.CONNECTING]: "bg-yellow-400 animate-pulse",
  [ConnectionState.CONNECTED]: "bg-green-400",
  [ConnectionState.AUTH_FAILED]: "bg-red-500",
};

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Disconnected",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Connected",
  [ConnectionState.AUTH_FAILED]: "Auth failed",
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
}

export function AppSidebar({
  connectionState,
  onSettingsClick,
  createSession,
}: Props) {
  const { threads, isLoadingThreads, selectedThreadId, loadThreads, selectThread } =
    useThreadList();
  const threadsCast = threads as ClawThread[];

  const [expandedByAgent, setExpandedByAgent] = useState<Record<string, boolean>>({});
  const [creatingForAgent, setCreatingForAgent] = useState<string | null>(null);

  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      loadThreads();
    }
  }, [connectionState, loadThreads]);

  const groups = useMemo(() => buildAgentGroups(threadsCast), [threadsCast]);

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
    if (!isLoadingThreads && threads.length > 0 && !selectedThreadId) {
      selectThread(threads[0].id);
    }
  }, [isLoadingThreads, threads, selectedThreadId, selectThread]);

  useEffect(() => {
    if (!isLoadingThreads && pendingSelectRef.current) {
      const id = pendingSelectRef.current;
      if (threads.some((t) => t.id === id)) {
        pendingSelectRef.current = null;
        selectThread(id);
      }
    }
  }, [isLoadingThreads, threads, selectThread]);

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
        }
      } finally {
        setCreatingForAgent(null);
      }
    },
    [createSession, runAfterRefresh]
  );

  return (
    <Shell.SidebarContainer>
      <Shell.SidebarHeader />
      <Shell.SidebarSeparator />

      <Shell.SidebarContent>
        {isLoadingThreads && (
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
                  {g.threads.map((t) => (
                    <div
                      key={t.id}
                      className={`openui-shell-thread-button${selectedThreadId === t.id ? " openui-shell-thread-button--selected" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => selectThread(t.id)}
                        className="openui-shell-thread-button-title"
                      >
                        {t.clawKind === "main" ? "Main" : t.title}
                      </button>
                    </div>
                  ))}

                  {/* TODO: sessions.delete blocked by gateway for webchat-ui clients — revisit */}

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

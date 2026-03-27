"use client";

import { useEffect } from "react";
import { useThreadList } from "@openuidev/react-headless";
import { Shell } from "@openuidev/react-ui";
import { ConnectionState } from "@/lib/gateway/types";

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

interface Props {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
}

export function AppSidebar({ connectionState, onSettingsClick }: Props) {
  const { threads, isLoadingThreads, selectedThreadId, loadThreads, selectThread } = useThreadList();

  // Trigger agents.list on mount (via fetchThreadList in ChatProvider)
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Auto-select the first agent once the list loads
  useEffect(() => {
    if (!isLoadingThreads && threads.length > 0 && !selectedThreadId) {
      selectThread(threads[0].id);
    }
  }, [isLoadingThreads, threads, selectedThreadId, selectThread]);

  return (
    <Shell.SidebarContainer>
      <Shell.SidebarHeader />
      <Shell.SidebarSeparator />

      <Shell.SidebarContent>
        {isLoadingThreads && (
          <p className="px-3 py-2 text-xs text-zinc-400">Loading agents…</p>
        )}
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => selectThread(thread.id)}
            className={`openui-shell-thread-button-title w-full text-left${selectedThreadId === thread.id ? " openui-shell-thread-button--selected" : ""}`}
          >
            {thread.title}
          </button>
        ))}
      </Shell.SidebarContent>

      {/* Connection status + settings gear in the sidebar footer */}
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
          <svg
            className="h-3.5 w-3.5 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </div>
    </Shell.SidebarContainer>
  );
}

"use client";

import { useEffect } from "react";
import { Settings } from "lucide-react";
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
          <Settings className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </div>
    </Shell.SidebarContainer>
  );
}

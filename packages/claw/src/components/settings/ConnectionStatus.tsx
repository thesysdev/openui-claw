"use client";

import { ConnectionState } from "@/lib/gateway/types";

interface Props {
  state: ConnectionState;
  onSettingsClick: () => void;
}

const STATES: Record<
  ConnectionState,
  { label: string; dot: string }
> = {
  [ConnectionState.DISCONNECTED]: {
    label: "Disconnected",
    dot: "bg-zinc-400",
  },
  [ConnectionState.CONNECTING]: {
    label: "Connecting…",
    dot: "bg-yellow-400 animate-pulse",
  },
  [ConnectionState.CONNECTED]: {
    label: "Connected",
    dot: "bg-green-400",
  },
  [ConnectionState.AUTH_FAILED]: {
    label: "Auth failed — click to reconfigure",
    dot: "bg-red-500",
  },
};

export function ConnectionStatus({ state, onSettingsClick }: Props) {
  const { label, dot } = STATES[state];

  return (
    <button
      onClick={onSettingsClick}
      title="Open settings"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-white/90 dark:bg-zinc-800/90 backdrop-blur border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
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
  );
}

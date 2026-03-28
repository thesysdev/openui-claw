"use client";

import { Settings } from "lucide-react";
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
      <Settings className="h-3.5 w-3.5 text-zinc-400" />
    </button>
  );
}

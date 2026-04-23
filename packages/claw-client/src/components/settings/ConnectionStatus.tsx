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
    dot: "bg-status-muted",
  },
  [ConnectionState.CONNECTING]: {
    label: "Connecting…",
    dot: "bg-status-warning animate-pulse",
  },
  [ConnectionState.CONNECTED]: {
    label: "Connected",
    dot: "bg-status-online",
  },
  [ConnectionState.AUTH_FAILED]: {
    label: "Auth failed — click to reconfigure",
    dot: "bg-status-error",
  },
  [ConnectionState.PAIRING]: {
    label: "Device pairing required",
    dot: "bg-status-warning animate-pulse",
  },
};

export function ConnectionStatus({ state, onSettingsClick }: Props) {
  const { label, dot } = STATES[state];

  return (
    <button
      onClick={onSettingsClick}
      title="Open settings"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium bg-background/90 backdrop-blur border border-border-default shadow-sm hover:shadow-md transition-shadow"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="text-text-neutral-secondary">{label}</span>
      <Settings className="h-3.5 w-3.5 text-text-neutral-tertiary" />
    </button>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

export interface ToolInvocationLogEntry {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  status: "pending" | "ok" | "error";
  refreshSeconds?: number;
}

export interface ToolInvocationLog {
  log: ToolInvocationLogEntry[];
  record(entry: Omit<ToolInvocationLogEntry, "id" | "status"> & { status?: "pending" }): string;
  updateStatus(id: string, patch: Partial<ToolInvocationLogEntry>): void;
  clear(): void;
}

const MAX_ENTRIES = 50;

function stableKey(toolName: string, args: Record<string, unknown>): string {
  try {
    return `${toolName}:${JSON.stringify(args, Object.keys(args).sort())}`;
  } catch {
    return `${toolName}:?`;
  }
}

/**
 * Keyed ring buffer for tool invocations surfaced in AppDebugPanel.
 *
 * Repeat polls for the same `{toolName, args}` overwrite the previous entry
 * rather than accreting, so a 5-second refresh Query produces one live row
 * instead of a log that grows without bound.
 */
export function useToolInvocationLog(): ToolInvocationLog {
  const [log, setLog] = useState<ToolInvocationLogEntry[]>([]);
  const idRef = useRef(0);

  const record = useCallback(
    (entry: Omit<ToolInvocationLogEntry, "id" | "status"> & { status?: "pending" }): string => {
      const key = stableKey(entry.toolName, entry.args);
      const id = `${key}#${++idRef.current}`;
      setLog((prev) => {
        const withoutKey = prev.filter((e) => !e.id.startsWith(`${key}#`));
        const next: ToolInvocationLogEntry = {
          ...entry,
          id,
          status: entry.status ?? "pending",
        };
        const merged = [next, ...withoutKey];
        return merged.slice(0, MAX_ENTRIES);
      });
      return id;
    },
    [],
  );

  const updateStatus = useCallback((id: string, patch: Partial<ToolInvocationLogEntry>): void => {
    setLog((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const clear = useCallback(() => {
    setLog([]);
  }, []);

  return { log, record, updateStatus, clear };
}

"use client";

import { Trash2, X } from "lucide-react";
import type { ToolInvocationLogEntry } from "./useToolInvocationLog";

interface Props {
  log: ToolInvocationLogEntry[];
  onClear: () => void;
  onClose: () => void;
}

function truncate(s: string, max = 2000): string {
  return s.length > max ? s.slice(0, max) + `\n…[${s.length - max} more chars]` : s;
}

function previewValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return truncate(value);
  try {
    return truncate(JSON.stringify(value, null, 2));
  } catch {
    return String(value);
  }
}

function formatDuration(start: number, end?: number): string {
  if (!end) return "…";
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusColor(status: ToolInvocationLogEntry["status"]): string {
  if (status === "error") return "bg-red-500";
  if (status === "pending") return "bg-amber-400 animate-pulse";
  return "bg-emerald-500";
}

export function AppDebugPanel({ log, onClear, onClose }: Props) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200">
          <span>🐛 Debug — Tool Invocations</span>
          <span className="text-zinc-400">({log.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Clear log"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Close debug panel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="px-3 py-4 text-center text-zinc-400">
          No tool invocations yet. Query/Mutation calls and render errors will appear here.
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          {log.map((entry) => (
            <details
              key={entry.id}
              className={`border-b border-zinc-200 px-3 py-2 last:border-b-0 dark:border-zinc-800 ${
                entry.status === "error" ? "bg-red-50/40 dark:bg-red-950/20" : ""
              }`}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor(entry.status)}`} />
                  <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                    {entry.toolName}
                  </span>
                  <span className="truncate text-zinc-500">
                    {previewValue(entry.args).slice(0, 80)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-zinc-400">
                  {entry.refreshSeconds != null && <span>↻ {entry.refreshSeconds}s</span>}
                  <span>{formatDuration(entry.startedAt, entry.finishedAt)}</span>
                  <span>{new Date(entry.startedAt).toLocaleTimeString()}</span>
                </div>
              </summary>
              <div className="mt-2 space-y-2 pl-4">
                <div>
                  <div className="mb-1 text-zinc-500">args</div>
                  <pre className="max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-zinc-100">
                    {previewValue(entry.args)}
                  </pre>
                </div>
                {entry.error ? (
                  <div>
                    <div className="mb-1 font-medium text-red-600 dark:text-red-400">error</div>
                    <pre className="max-h-40 overflow-auto rounded bg-red-950/70 p-2 text-red-100">
                      {entry.error}
                    </pre>
                  </div>
                ) : entry.result !== undefined ? (
                  <div>
                    <div className="mb-1 text-zinc-500">result</div>
                    <pre className="max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-zinc-100">
                      {previewValue(entry.result)}
                    </pre>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

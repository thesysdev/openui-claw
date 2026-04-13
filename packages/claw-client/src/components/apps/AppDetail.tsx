"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import type { AppRecord, AppStore } from "@/lib/engines/types";

interface Props {
  appId: string;
  apps: AppStore;
  onDeleted: () => void;
}

export function AppDetail({ appId, apps, onDeleted }: Props) {
  const [record, setRecord] = useState<AppRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setRecord(null);
    apps
      .getApp(appId)
      .then((r) => {
        if (!r) setNotFound(true);
        else setRecord(r);
      })
      .finally(() => setLoading(false));
  }, [appId, apps]);

  // Build a toolProvider that bridges Query/Mutation in the app markup to
  // gateway RPCs — no LLM hop; the plugin executes tools directly.
  // record.sessionKey scopes every tool call to the app's agent session so
  // exec approvals, memory access, etc. are attributed correctly.
  const toolProvider = useMemo(
    () => ({
      tools_invoke: async (args: Record<string, unknown>) => {
        const toolName = typeof args.tool_name === "string" ? args.tool_name : "";
        const toolArgs =
          args.tool_args != null && typeof args.tool_args === "object" && !Array.isArray(args.tool_args)
            ? (args.tool_args as Record<string, unknown>)
            : {};
        const result = await apps.invokeTool(toolName, toolArgs, record?.sessionKey);
        return { result };
      },
    }),
    [apps, record?.sessionKey],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-400">Loading app…</p>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">App not found</p>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await apps.deleteApp(appId);
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h1 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {record.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Delete app"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* App canvas */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <Renderer library={openuiLibrary} response={record.content} toolProvider={toolProvider} />
      </div>
    </div>
  );
}

"use client";

import type { AppRecord, AppStore } from "@/lib/engines/types";
import {
  buildContinueConversationPayload,
  handleOpenUrlAction,
} from "@/lib/renderer-actions";
import type { ActionEvent } from "@openuidev/react-lang";
import { Renderer } from "@openuidev/react-lang";
import { Callout } from "@openuidev/react-ui";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { Bug, Code2, Eye, Pin, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppDebugPanel } from "./AppDebugPanel";
import { useToolInvocationLog } from "./useToolInvocationLog";

/**
 * Called when a `ContinueConversation` action fires inside a standalone app
 * view. Implementations are expected to route the message to the app's
 * origin chat session, pin the app into that session's workspace, and open
 * the app preview on the side (mirroring the Refine flow) — see
 * `ChatAppInner.handleAppContinueConversation`.
 */
export type AppContinueConversationHandler = (payload: {
  message: { role: "user"; content: string };
  appRecord: AppRecord;
}) => void;

function normalizeToolResult(result: unknown): unknown {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const candidate = result as Record<string, unknown>;
    if (typeof candidate.stdout === "string") {
      const trimmed = candidate.stdout.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // Fall through to the raw tool result below.
        }
      }
    }
  }

  return result;
}

interface Props {
  appId: string;
  apps: AppStore;
  updatedAt?: string;
  onDeleted?: () => void;
  isPinned?: boolean;
  onTogglePinned?: (appId: string) => void;
  onRefine?: (record: AppRecord) => void | Promise<void>;
  /**
   * Handler invoked when the app emits a `ContinueConversation` action
   * (e.g. a Button with `Action([@ToAssistant("...")])`). The parent is
   * responsible for routing the message to the app's origin thread.
   */
  onContinueConversation?: AppContinueConversationHandler;
  mode?: "page" | "panel";
}

export function AppDetail({
  appId,
  apps,
  updatedAt,
  onDeleted,
  isPinned = false,
  onTogglePinned,
  onRefine,
  onContinueConversation,
  mode = "page",
}: Props) {
  const [record, setRecord] = useState<AppRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [renderErrors, setRenderErrors] = useState<string[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  // Captures the latest reactive state from the Renderer so @ToAssistant
  // actions can prefix the user's message with what the app was showing.
  const stateRef = useRef<Record<string, unknown>>({});
  const toolLog = useToolInvocationLog();

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setRecord(null);
    setRenderErrors([]);
    apps
      .getApp(appId)
      .then((r) => {
        if (!r) setNotFound(true);
        else setRecord(r);
      })
      .finally(() => setLoading(false));
  }, [appId, apps, updatedAt]);

  // Route built-in Renderer actions through the shared handler module.
  //   - `OpenUrl`              → open in a new tab.
  //   - `ContinueConversation` → delegated to the parent via
  //     `onContinueConversation`, which is expected to select the app's
  //     origin thread and post the message there. Silently no-ops when the
  //     parent didn't supply a handler (e.g. a preview surface that doesn't
  //     own routing).
  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (handleOpenUrlAction(event)) return;

      // Prefix the message with appId + live reactive state so the assistant
      // can (a) call get_app(id) for the static code, (b) see what the user
      // was looking at without re-asking. Query result status is deliberately
      // NOT included — the agent can just query the DB itself.
      const appContext =
        record != null
          ? {
              appId: record.id,
              appTitle: record.title,
              currentState: { ...stateRef.current },
            }
          : undefined;

      const payload = buildContinueConversationPayload(event, undefined, appContext);
      if (payload && onContinueConversation && record) {
        onContinueConversation({ message: payload, appRecord: record });
      }
    },
    [onContinueConversation, record],
  );

  // Build a toolProvider that bridges Query/Mutation in the app markup to
  // gateway RPCs — no LLM hop; the plugin executes tools directly.
  // record.sessionKey scopes every tool call to the app's agent session so
  // exec approvals, memory access, etc. are attributed correctly.
  const toolProvider = useMemo(() => {
    const invokeScopedTool = async (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<unknown> => {
      const startedAt = Date.now();
      const entryId = toolLog.record({ toolName, args, startedAt });
      try {
        const result = await apps.invokeTool(toolName, args, record?.sessionKey);
        const normalized = normalizeToolResult(result);
        toolLog.updateStatus(entryId, {
          result: normalized,
          status: "ok",
          finishedAt: Date.now(),
        });
        return normalized;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toolLog.updateStatus(entryId, {
          error: message,
          status: "error",
          finishedAt: Date.now(),
        });
        throw err;
      }
    };

    return {
      exec: async (args: Record<string, unknown>) => invokeScopedTool("exec", args),
      read: async (args: Record<string, unknown>) => invokeScopedTool("read", args),
      db_query: async (args: Record<string, unknown>) => invokeScopedTool("db_query", args),
      db_execute: async (args: Record<string, unknown>) => invokeScopedTool("db_execute", args),
    };
  }, [apps, record?.sessionKey, toolLog]);

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
      onDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {mode === "page" && (
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {record.title}
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Interactive app created by {record.agentId}
            </p>
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              viewMode === "preview"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setViewMode("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              viewMode === "code"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setViewMode("code")}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              debugOpen
                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setDebugOpen((v) => !v)}
            title="Toggle debug panel"
          >
            <Bug className="h-3.5 w-3.5" />
            Debug
          </button>
          {onTogglePinned && (
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                isPinned
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
              onClick={() => onTogglePinned(appId)}
            >
              <Pin className="h-3.5 w-3.5" />
              {isPinned ? "Pinned" : "Pin"}
            </button>
          )}
          {onRefine && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              onClick={() => void onRefine(record)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Refine
            </button>
          )}
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
              type="button"
              onClick={handleDelete}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Delete app"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {renderErrors.length > 0 && (
          <div className="mb-4">
            <Callout
              variant="danger"
              title="This app has render errors"
              description={renderErrors[0] ?? "Renderer error"}
            />
          </div>
        )}

        {debugOpen && (
          <div className="mb-4">
            <AppDebugPanel
              log={toolLog.log}
              onClear={toolLog.clear}
              onClose={() => setDebugOpen(false)}
            />
          </div>
        )}

        {viewMode === "preview" ? (
          <Renderer
            library={openuiLibrary}
            response={record.content}
            toolProvider={toolProvider}
            onAction={handleAction}
            onStateUpdate={(state) => {
              stateRef.current = state;
            }}
            onError={(errors) => {
              const messages = errors.map((error) =>
                typeof error === "string"
                  ? error
                  : error instanceof Error
                    ? error.message
                    : JSON.stringify(error),
              );
              setRenderErrors(messages);
              // Surface render errors in the debug log too — the toolProvider
              // instrumentation only catches Query/Mutation failures, not AST
              // or prop validation errors raised by the Renderer itself.
              if (messages.length > 0) {
                const now = Date.now();
                const id = toolLog.record({
                  toolName: "renderer-error",
                  args: { count: messages.length },
                  startedAt: now,
                });
                toolLog.updateStatus(id, {
                  error: messages.join("\n\n"),
                  status: "error",
                  finishedAt: now,
                });
              }
            }}
          />
        ) : (
          <pre className="overflow-auto rounded-2xl bg-zinc-950 p-4 text-xs text-zinc-100">
            {record.content}
          </pre>
        )}
      </div>
    </div>
  );
}

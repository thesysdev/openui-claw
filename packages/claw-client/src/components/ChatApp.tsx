"use client";

import {
  AppDetail,
  type AppContinueConversationHandler,
} from "@/components/apps/AppDetail";
import { ArtifactDetail } from "@/components/artifacts/ArtifactDetail";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";
import { CommandPalette } from "@/components/CommandPalette";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  NotificationInboxDrawer,
  NotificationInboxPane,
} from "@/components/notifications/NotificationInbox";
import { AssistantMessage } from "@/components/rendering/AssistantMessage";
import { UserMessage } from "@/components/rendering/UserMessage";
import { SessionComposer } from "@/components/session/SessionComposer";
import { ComposerToolbar } from "@/components/session/SessionControls";
import { SessionPreviewPanels } from "@/components/session/SessionPreviewPanels";
import {
  SessionWorkspaceDrawer,
  SessionWorkspacePane,
} from "@/components/session/SessionWorkspacePane";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { loadPinnedAppIds, savePinnedAppIds } from "@/lib/app-pins";
import { openClawAdapter } from "@/lib/chat/openClawAdapter";
import { serializeAssistantTimelineContent } from "@/lib/chat/timeline";
import {
  resolveChatSessionKey,
  sessionRouteIdFromSessionKey,
  useGateway,
} from "@/lib/chat/useGateway";
import type { CommandContext, CommandMessageSnapshot } from "@/lib/commands";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";
import type {
  AppRecord,
  AppStore,
  AppSummary,
  ArtifactStore,
  ArtifactSummary,
  GatewayCommand,
  UploadStore,
} from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";
import { navigate, useHashRoute } from "@/lib/hooks/useHashRoute";
import type { NotificationRecord } from "@/lib/notifications";
import {
  EMPTY_THREAD_WORKSPACE,
  deriveThreadWorkspaceFromMessages,
  fileToThreadUpload,
  sessionAppPreviewId,
  sessionArtifactPreviewId,
  sessionUploadPreviewId,
  uploadMetaToThreadUpload,
  type ThreadUpload,
  type ThreadWorkspaceState,
} from "@/lib/session-workspace";
import { getSettings } from "@/lib/storage";
import { UploadsProvider, type UploadsSeed } from "@/lib/uploads-context";
import type { ClawThread } from "@/types/claw-thread";
import type { ClawThreadListItem, ModelChoice, SessionRow } from "@/types/gateway-responses";
import type { Message, Thread } from "@openuidev/react-headless";
import {
  ChatProvider,
  useActiveArtifact,
  useArtifactStore,
  useThread,
  useThreadList,
} from "@openuidev/react-headless";
import { Shell, ThemeProvider } from "@openuidev/react-ui";
import { BellRing, PanelRightOpen, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Same default used by FullScreen — swap for a custom Claw logo later.
const LOGO_URL = "https://www.openui.com/favicon.svg";
const ENABLE_THREAD_REPLY_NOTIFICATIONS = false;

function toThreadRow(r: ClawThreadListItem): Thread {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    clawKind: r.clawKind,
    clawAgentId: r.clawAgentId,
  } as Thread;
}

type NotificationToastNotice = {
  id: string;
  notification: NotificationRecord;
};

function NotificationToastViewport({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: NotificationToastNotice[];
  onDismiss: (toastId: string) => void;
  onOpen: (notification: NotificationRecord, toastId: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/92"
        >
          <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <BellRing className="h-4 w-4" />
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onOpen(toast.notification, toast.id)}
            >
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {toast.notification.title}
                </p>
                {toast.notification.unread ? (
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                ) : null}
              </div>
              <p className="mt-1 max-h-[4.5rem] overflow-hidden text-sm text-zinc-600 dark:text-zinc-300">
                {toast.notification.message}
              </p>
            </button>
            <button
              type="button"
              className="rounded-xl p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              onClick={() => onDismiss(toast.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThreadArea({
  sessionMeta,
  availableModels,
  patchSession,
  resetSession,
  compactSession,
  onSessionChanged,
  loadThread,
  knownAgentIds,
  appList,
  artifactList,
  apps,
  artifacts,
  uploads,
  pinnedAppIds,
  onTogglePinned,
  workspaceByThread,
  onUpdateThreadWorkspace,
  onMarkUploadsSent,
  onRemoveUpload,
  onRefreshDurables,
  onRefreshSummaries,
  pendingPreviewOpen,
  onConsumePendingPreview,
  onRefineApp,
  onAppContinueConversation,
  workspacePaneCollapsed,
  onToggleWorkspacePaneCollapsed,
  gatewayCommands,
}: {
  sessionMeta: Map<string, SessionRow>;
  availableModels: ModelChoice[];
  patchSession: (key: string, patch: Record<string, unknown>) => Promise<boolean>;
  resetSession: (sessionKey: string) => Promise<boolean>;
  compactSession: (sessionKey: string) => Promise<boolean>;
  onSessionChanged: (listener: (sessionKey: string) => void) => () => void;
  loadThread: (threadId: string) => Promise<Message[]>;
  knownAgentIds: React.RefObject<Set<string>>;
  appList: AppSummary[];
  artifactList: ArtifactSummary[];
  apps: AppStore | undefined;
  artifacts: ArtifactStore | undefined;
  uploads: UploadStore | undefined;
  pinnedAppIds: Set<string>;
  onTogglePinned: (appId: string) => void;
  workspaceByThread: Record<string, ThreadWorkspaceState>;
  onUpdateThreadWorkspace: (
    threadId: string,
    updater: (current: ThreadWorkspaceState) => ThreadWorkspaceState,
  ) => void;
  onMarkUploadsSent: (threadId: string, uploadIds: string[]) => void;
  onRemoveUpload: (threadId: string, uploadId: string) => void;
  onRefreshDurables: () => Promise<void> | void;
  onRefreshSummaries: () => void;
  pendingPreviewOpen: { threadId: string; previewId: string } | null;
  onConsumePendingPreview: () => void;
  onRefineApp: (record: AppRecord) => void | Promise<void>;
  onAppContinueConversation: AppContinueConversationHandler;
  workspacePaneCollapsed: boolean;
  onToggleWorkspacePaneCollapsed: (collapsed: boolean) => void;
  gatewayCommands: GatewayCommand[];
}) {
  const { selectedThreadId } = useThreadList();
  const isRunning = useThread((state) => state.isRunning);
  const threadMessages = useThread((state) => state.messages);
  const setThreadMessages = useThread((state) => state.setMessages);
  const artifactStore = useArtifactStore();
  const { activeArtifactId } = useActiveArtifact();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousRunningRef = useRef(false);
  const [commandToast, setCommandToast] = useState<{
    message: string;
    kind: "info" | "success" | "error";
  } | null>(null);
  // Locally-known uploads — seeded the moment `uploads.put` resolves so the
  // `UserMessage` thumbnail renders immediately, without waiting for the next
  // `uploads.list` refresh to include the new id.
  const [uploadSeeds, setUploadSeeds] = useState<UploadsSeed[]>([]);

  useEffect(() => {
    if (!commandToast) return;
    const timer = setTimeout(() => setCommandToast(null), 3000);
    return () => clearTimeout(timer);
  }, [commandToast]);
  const autoPreviewStateRef = useRef<{
    threadId: string;
    baselineAppIds: Set<string>;
    baselineArtifactIds: Set<string>;
    openedAppIds: Set<string>;
    openedArtifactIds: Set<string>;
  } | null>(null);
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);

  const sessionKey = useMemo(() => {
    if (!selectedThreadId) return null;
    return resolveChatSessionKey(selectedThreadId, knownAgentIds.current);
  }, [selectedThreadId, knownAgentIds]);

  const meta = sessionKey ? sessionMeta.get(sessionKey) : undefined;
  const workspace =
    (selectedThreadId ? workspaceByThread[selectedThreadId] : undefined) ?? EMPTY_THREAD_WORKSPACE;

  const sessionApps = useMemo(
    () => (sessionKey ? appList.filter((app) => app.sessionKey === sessionKey) : []),
    [appList, sessionKey],
  );

  const sessionArtifacts = useMemo(
    () =>
      sessionKey ? artifactList.filter((artifact) => artifact.source.sessionId === sessionKey) : [],
    [artifactList, sessionKey],
  );
  const workspaceCount = workspace.uploads.length + (workspace.linkedApp ? 1 : 0);

  useEffect(() => {
    const wasRunning = previousRunningRef.current;

    if (!wasRunning && isRunning && selectedThreadId) {
      autoPreviewStateRef.current = {
        threadId: selectedThreadId,
        baselineAppIds: new Set(sessionApps.map((app) => app.id)),
        baselineArtifactIds: new Set(sessionArtifacts.map((artifact) => artifact.id)),
        openedAppIds: new Set(),
        openedArtifactIds: new Set(),
      };
    }

    if (wasRunning && !isRunning) {
      onRefreshSummaries();
    }

    previousRunningRef.current = isRunning;
  }, [isRunning, onRefreshSummaries, selectedThreadId, sessionApps, sessionArtifacts]);

  useEffect(() => {
    if (autoPreviewStateRef.current && autoPreviewStateRef.current.threadId !== selectedThreadId) {
      autoPreviewStateRef.current = null;
    }
  }, [selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId || !isRunning) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const refreshLoop = async () => {
      try {
        await onRefreshDurables();
      } catch (error) {
        console.warn("[claw] durable refresh failed:", error);
      }
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        void refreshLoop();
      }, 1500);
    };

    timeoutId = setTimeout(() => {
      void refreshLoop();
    }, 1200);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isRunning, onRefreshDurables, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const tracker = autoPreviewStateRef.current;
    if (!tracker || tracker.threadId !== selectedThreadId) return;

    const nextArtifact = sessionArtifacts.find(
      (artifact) =>
        !tracker.baselineArtifactIds.has(artifact.id) &&
        !tracker.openedArtifactIds.has(artifact.id),
    );

    if (nextArtifact) {
      tracker.openedArtifactIds.add(nextArtifact.id);
      artifactStore.getState().openArtifact(sessionArtifactPreviewId(nextArtifact.id));
      return;
    }

    const nextApp = sessionApps.find(
      (app) => !tracker.baselineAppIds.has(app.id) && !tracker.openedAppIds.has(app.id),
    );

    if (nextApp && tracker.openedArtifactIds.size === 0) {
      tracker.openedAppIds.add(nextApp.id);
      artifactStore.getState().openArtifact(sessionAppPreviewId(nextApp.id));
    }
  }, [artifactStore, selectedThreadId, sessionApps, sessionArtifacts]);

  useEffect(() => {
    if (
      pendingPreviewOpen &&
      selectedThreadId &&
      pendingPreviewOpen.threadId === selectedThreadId
    ) {
      artifactStore.getState().openArtifact(pendingPreviewOpen.previewId);
      onConsumePendingPreview();
    }
  }, [artifactStore, onConsumePendingPreview, pendingPreviewOpen, selectedThreadId]);

  const handleFilesSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedThreadId) return;
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;

      const nextUploads = await Promise.all(files.map((file) => fileToThreadUpload(file)));
      onUpdateThreadWorkspace(selectedThreadId, (current) => ({
        ...current,
        uploads: [...current.uploads, ...nextUploads],
      }));
      event.target.value = "";

      // Persist bytes to the plugin's UploadStore so previews survive reload
      // after OpenClaw's 2-minute media TTL expires. Use the resolved session
      // key (not the raw threadId) so agent-main threads scope correctly.
      if (uploads && sessionKey) {
        const threadId = selectedThreadId;
        const scopedSessionKey = sessionKey;
        await Promise.all(
          nextUploads.map(async (upload) => {
            if (!upload.attachment?.content) return;
            const meta = await uploads.putUpload({
              sessionKey: scopedSessionKey,
              name: upload.name,
              mimeType: upload.mimeType,
              content: upload.attachment.content,
              size: upload.size,
            });
            if (!meta) return;
            // Seed provider with the remote meta + a locally-synthesized data
            // URL so `InlineUploadChip` gets both `kind` and `dataUrl` on its
            // first render, rather than falling back to the generic chip while
            // `uploads.list` catches up.
            const previewDataUrl = upload.attachment?.content
              ? `data:${upload.mimeType};base64,${upload.attachment.content}`
              : undefined;
            setUploadSeeds((prev) => {
              const next = prev.filter((entry) => entry.meta.id !== meta.id);
              next.push(previewDataUrl ? { meta, previewDataUrl } : { meta });
              return next;
            });
            onUpdateThreadWorkspace(threadId, (current) => ({
              ...current,
              uploads: current.uploads.map((candidate) =>
                candidate.id === upload.id ? { ...candidate, remoteId: meta.id } : candidate,
              ),
            }));
          }),
        );
      }
    },
    [onUpdateThreadWorkspace, selectedThreadId, sessionKey, uploads],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const downloadBlob = useCallback((filename: string, mimeType: string, content: string | Blob) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  const buildCommandContext = useCallback((): CommandContext => {
    const messages = threadMessages.map((message: Message) => {
      const contentRaw = (message as { content?: unknown }).content;
      const content =
        typeof contentRaw === "string"
          ? contentRaw
          : Array.isArray(contentRaw)
            ? contentRaw
                .map((part) =>
                  part && typeof part === "object" && "text" in part
                    ? String((part as { text?: unknown }).text ?? "")
                    : "",
                )
                .join("")
            : "";
      return {
        id: message.id,
        role:
          message.role === "user"
            ? "user"
            : message.role === "assistant"
              ? "assistant"
              : "activity",
        content,
      } as CommandMessageSnapshot;
    });

    return {
      threadId: selectedThreadId ?? null,
      threadTitle: meta?.derivedTitle ?? meta?.displayName ?? meta?.label ?? undefined,
      messages,
      apps,
      artifacts,
      uploads,
      toast: (message, kind = "info") => setCommandToast({ message, kind }),
      downloadBlob,
    };
  }, [
    apps,
    artifacts,
    downloadBlob,
    meta,
    selectedThreadId,
    threadMessages,
    uploads,
  ]);

  // Gateway commands that map 1:1 to a dedicated RPC. Dispatching these
  // through `chat.send` doesn't trigger the gateway's command handler for the
  // webchat channel — the slash text just reaches the LLM — so we call the
  // RPC directly instead.
  // Refresh the current thread when the gateway reports an out-of-band
  // transcript change — subagent completions, external sessions.send, or
  // anything that lands after our run listener has been torn down. Debounce
  // briefly so a burst of events (e.g. several subagent steps) collapses.
  // While an active stream is driving the store, skip the reload entirely —
  // the stream is authoritative and a `setMessages` mid-run wipes the
  // optimistic user bubble + streaming assistant message, producing a flicker
  // until the next event arrives. A trailing sessions.changed after
  // RUN_FINISHED still fires the reload to reshape the stream into per-message
  // cards.
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    if (!selectedThreadId) return;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handler = (changedKey: string) => {
      if (!selectedThreadId) return;
      const scopedKey = resolveChatSessionKey(selectedThreadId, knownAgentIds.current);
      if (changedKey !== scopedKey) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        if (isRunningRef.current) return;
        void loadThread(selectedThreadId)
          .then((messages) => setThreadMessages(messages))
          .catch((err) => console.warn("[claw] session-changed reload failed:", err));
      }, 400);
    };
    const unsubscribe = onSessionChanged(handler);
    return () => {
      if (pending) clearTimeout(pending);
      unsubscribe();
    };
  }, [selectedThreadId, onSessionChanged, loadThread, setThreadMessages, knownAgentIds]);

  const dispatchGatewayCommand = useCallback(
    async (name: string, _args: string): Promise<boolean> => {
      if (!sessionKey) return false;
      if (name === "reset" || name === "new") {
        const ok = await resetSession(sessionKey);
        setCommandToast({
          message: ok ? "Thread reset" : "Reset failed",
          kind: ok ? "success" : "error",
        });
        if (ok) setThreadMessages([]);
        return true;
      }
      if (name === "compact") {
        const ok = await compactSession(sessionKey);
        setCommandToast({
          message: ok ? "Compaction started" : "Compaction failed",
          kind: ok ? "success" : "error",
        });
        return true;
      }
      return false;
    },
    [compactSession, resetSession, sessionKey, setThreadMessages],
  );

  return (
    <UploadsProvider store={uploads} sessionKey={sessionKey} seeds={uploadSeeds}>
      <div className="flex h-full min-w-0 flex-1 overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        <Shell.ThreadContainer className="openui-claw-thread-container min-w-0 flex-1">
          <Shell.MobileHeader />
          <Shell.ScrollArea>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Shell.Messages
              assistantMessage={AssistantMessage}
              userMessage={UserMessage as any}
              loader={<Shell.MessageLoading />}
            />
          </Shell.ScrollArea>
          <ComposerToolbar
            meta={meta}
            models={availableModels}
            onPatch={patchSession}
            sessionKey={sessionKey}
          />
          <div className="px-3 pb-2 sm:px-4 lg:hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white/90 px-4 py-3 text-left text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setMobileWorkspaceOpen(true)}
            >
              <span>Thread workspace</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                {workspaceCount + sessionApps.length + sessionArtifacts.length}
              </span>
            </button>
          </div>
          <SessionComposer
            uploads={workspace.uploads}
            linkedApp={workspace.linkedApp}
            onPickFiles={openFilePicker}
            onRemoveUpload={(uploadId) => {
              if (!selectedThreadId) return;
              onRemoveUpload(selectedThreadId, uploadId);
              artifactStore.getState().closeArtifact(sessionUploadPreviewId(uploadId));
            }}
            onUploadsSent={(uploadIds) => {
              if (!selectedThreadId) return;
              onMarkUploadsSent(selectedThreadId, uploadIds);
            }}
            commandContext={buildCommandContext}
            gatewayCommands={gatewayCommands}
            onDispatchGatewayCommand={dispatchGatewayCommand}
          />
          {commandToast && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 transform">
              <div
                className={`pointer-events-auto rounded-xl border px-4 py-2 text-xs font-medium shadow-lg ${
                  commandToast.kind === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/70 dark:text-red-200"
                    : commandToast.kind === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/70 dark:text-emerald-200"
                      : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
              >
                {commandToast.message}
              </div>
            </div>
          )}
          <SessionPreviewPanels
            apps={sessionApps}
            allApps={appList}
            linkedApp={workspace.linkedApp}
            artifacts={sessionArtifacts}
            uploads={workspace.uploads}
            appStore={apps}
            artifactStore={artifacts}
            uploadStore={uploads}
            pinnedAppIds={pinnedAppIds}
            onTogglePinned={onTogglePinned}
            onRefineApp={onRefineApp}
            onAppContinueConversation={onAppContinueConversation}
            onRefreshApps={onRefreshSummaries}
            onRefreshArtifacts={onRefreshSummaries}
          />
        </Shell.ThreadContainer>

        <SessionWorkspaceDrawer
          open={mobileWorkspaceOpen}
          onClose={() => setMobileWorkspaceOpen(false)}
          apps={sessionApps}
          artifacts={sessionArtifacts}
          uploads={workspace.uploads}
          linkedApp={workspace.linkedApp}
          pinnedAppIds={pinnedAppIds}
          activePreviewId={activeArtifactId}
          onOpenApp={(appId) => {
            artifactStore.getState().openArtifact(sessionAppPreviewId(appId));
            setMobileWorkspaceOpen(false);
          }}
          onOpenArtifact={(artifactId) => {
            artifactStore.getState().openArtifact(sessionArtifactPreviewId(artifactId));
            setMobileWorkspaceOpen(false);
          }}
          onOpenUpload={(uploadId) => {
            artifactStore.getState().openArtifact(sessionUploadPreviewId(uploadId));
            setMobileWorkspaceOpen(false);
          }}
          onTogglePinned={onTogglePinned}
          onPickFiles={() => {
            setMobileWorkspaceOpen(false);
            openFilePicker();
          }}
        />

        {workspacePaneCollapsed ? (
          <div className="hidden h-full w-14 shrink-0 border-l border-zinc-200/70 bg-gradient-to-b from-white/96 via-white/92 to-slate-50/65 dark:border-zinc-800 dark:from-zinc-950/92 dark:via-zinc-950/82 dark:to-slate-950/25 lg:flex">
            <button
              type="button"
              className="m-2 flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={() => onToggleWorkspacePaneCollapsed(false)}
              aria-label="Expand thread workspace"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <SessionWorkspacePane
            apps={sessionApps}
            artifacts={sessionArtifacts}
            uploads={workspace.uploads}
            linkedApp={workspace.linkedApp}
            pinnedAppIds={pinnedAppIds}
            activePreviewId={activeArtifactId}
            onCollapse={() => onToggleWorkspacePaneCollapsed(true)}
            onOpenApp={(appId) => artifactStore.getState().openArtifact(sessionAppPreviewId(appId))}
            onOpenArtifact={(artifactId) =>
              artifactStore.getState().openArtifact(sessionArtifactPreviewId(artifactId))
            }
            onOpenUpload={(uploadId) =>
              artifactStore.getState().openArtifact(sessionUploadPreviewId(uploadId))
            }
            onTogglePinned={onTogglePinned}
            onPickFiles={openFilePicker}
          />
        )}
      </div>
    </UploadsProvider>
  );
}

interface ChatAppInnerProps {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  createSession: (agentId: string) => Promise<string | null>;
  renameSession: (threadId: string, label: string) => Promise<boolean>;
  deleteSession: (threadId: string) => Promise<boolean>;
  resetSession: (sessionKey: string) => Promise<boolean>;
  compactSession: (sessionKey: string) => Promise<boolean>;
  onSessionChanged: (listener: (sessionKey: string) => void) => () => void;
  loadThread: (threadId: string) => Promise<Message[]>;
  sessionMeta: Map<string, SessionRow>;
  availableModels: ModelChoice[];
  patchSession: (key: string, patch: Record<string, unknown>) => Promise<boolean>;
  knownAgentIds: React.RefObject<Set<string>>;
  artifacts: ArtifactStore | undefined;
  apps: AppStore | undefined;
  uploads: UploadStore | undefined;
  appList: AppSummary[];
  artifactList: ArtifactSummary[];
  pinnedAppIds: Set<string>;
  onTogglePinned: (appId: string) => void;
  workspaceByThread: Record<string, ThreadWorkspaceState>;
  onUpdateThreadWorkspace: (
    threadId: string,
    updater: (current: ThreadWorkspaceState) => ThreadWorkspaceState,
  ) => void;
  onMarkUploadsSent: (threadId: string, uploadIds: string[]) => void;
  onRemoveUpload: (threadId: string, uploadId: string) => void;
  pendingPreviewOpen: { threadId: string; previewId: string } | null;
  onSetPendingPreviewOpen: (value: { threadId: string; previewId: string }) => void;
  onConsumePendingPreview: () => void;
  onDeleteApp: (appId: string) => Promise<void>;
  onRefreshApps: () => void;
  onRefreshArtifacts: () => void;
  notifications: NotificationRecord[];
  onMarkNotificationsRead: (ids?: string[]) => Promise<boolean>;
  onRefreshNotifications: () => Promise<NotificationRecord[]>;
  onUpsertNotification: (
    notification: Omit<NotificationRecord, "id" | "createdAt" | "updatedAt" | "unread" | "readAt">,
  ) => Promise<boolean>;
  cronJobs: CronJobRecord[];
  cronRuns: CronRunEntry[];
  cronStatus: CronStatusRecord | null;
  onRefreshCronData: () => Promise<{
    jobs: CronJobRecord[];
    runs: CronRunEntry[];
    status: CronStatusRecord | null;
  }>;
  gatewayCommands: GatewayCommand[];
}

function ChatAppInner({
  connectionState,
  onSettingsClick,
  createSession,
  renameSession,
  deleteSession,
  resetSession,
  compactSession,
  onSessionChanged,
  loadThread,
  sessionMeta,
  availableModels,
  patchSession,
  knownAgentIds,
  artifacts,
  apps,
  uploads,
  appList,
  artifactList,
  pinnedAppIds,
  onTogglePinned,
  workspaceByThread,
  onUpdateThreadWorkspace,
  onMarkUploadsSent,
  onRemoveUpload,
  pendingPreviewOpen,
  onSetPendingPreviewOpen,
  onConsumePendingPreview,
  onDeleteApp,
  onRefreshApps,
  onRefreshArtifacts,
  notifications,
  onMarkNotificationsRead,
  onRefreshNotifications,
  onUpsertNotification,
  cronJobs,
  cronRuns,
  cronStatus,
  onRefreshCronData,
  gatewayCommands,
}: ChatAppInnerProps) {
  // Extra (non-destructured-above) props that flow through ChatAppInner.
  // Using `arguments` would be noisy; re-grab via a local re-assignment.
  const route = useHashRoute() ?? { view: "home" as const };
  const { threads, selectedThreadId, selectThread, loadThreads } = useThreadList();
  const selectedThreadIsRunning = useThread((state) => state.isRunning);
  const dispatchChatProcessMessage = useThread((state) => state.processMessage);
  const [mobileNotificationInboxOpen, setMobileNotificationInboxOpen] = useState(false);
  const [notificationPaneCollapsed, setNotificationPaneCollapsed] = useState(false);
  const [workspacePaneCollapsed, setWorkspacePaneCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const [toastNotices, setToastNotices] = useState<NotificationToastNotice[]>([]);
  const notificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsPrimedRef = useRef(false);
  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications],
  );
  const backgroundRunTrackersRef = useRef(
    new Map<
      string,
      {
        threadId: string;
        sessionKey: string;
        title: string;
        agentId: string;
        baselineUpdatedAt: number;
        baselineNotificationIds: Set<string>;
        leftThread: boolean;
      }
    >(),
  );

  const collectThreadNotificationIds = useCallback(
    (threadId: string, sessionKey: string) =>
      new Set(
        notifications
          .filter((notification) => {
            if (!notification.unread) return false;
            if (notification.target.view === "chat" && notification.target.sessionId === threadId) {
              return true;
            }
            return notification.source?.sessionKey === sessionKey;
          })
          .map((notification) => notification.id),
      ),
    [notifications],
  );
  const activeAppUpdatedAt = useMemo(
    () =>
      route.view === "app" ? appList.find((app) => app.id === route.appId)?.updatedAt : undefined,
    [appList, route],
  );
  const activeArtifactUpdatedAt = useMemo(
    () =>
      route.view === "artifact"
        ? artifactList.find((artifact) => artifact.id === route.artifactId)?.updatedAt
        : undefined,
    [artifactList, route],
  );
  const hiddenRefinementThreadIds = useMemo(() => {
    const hidden = new Set<string>();

    Object.entries(workspaceByThread).forEach(([threadId, workspace]) => {
      const linkedAppSessionKey = workspace.linkedApp?.sessionKey;
      if (!linkedAppSessionKey) return;

      const sourceThreadId = sessionRouteIdFromSessionKey(
        linkedAppSessionKey,
        knownAgentIds.current,
      );

      if (threadId !== sourceThreadId) {
        hidden.add(threadId);
      }
    });

    return hidden;
  }, [knownAgentIds, workspaceByThread]);

  // Sent uploads hydrate via engine.uploads.listUploads once the engine is ready.
  // Backfill here in case ChatProvider loaded the thread before the engine connected.
  useEffect(() => {
    if (!uploads || !selectedThreadId) return;
    const threadId = selectedThreadId;
    const resolvedKey = resolveChatSessionKey(threadId, knownAgentIds.current);
    let cancelled = false;
    void uploads.listUploads(resolvedKey).then((metas) => {
      if (cancelled) return;
      onUpdateThreadWorkspace(threadId, (current) => {
        const existingPending = current.uploads.filter((upload) => upload.status === "pending");
        const remoteUploads = metas.map(uploadMetaToThreadUpload);
        return {
          uploads: [...remoteUploads, ...existingPending],
          linkedApp: current.linkedApp,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [uploads, selectedThreadId, knownAgentIds, onUpdateThreadWorkspace]);

  const notificationMatchesRoute = useCallback(
    (notification: NotificationRecord) => {
      switch (notification.target.view) {
        case "chat":
          return route.view === "chat" && route.sessionId === notification.target.sessionId;
        case "app":
          return route.view === "app" && route.appId === notification.target.appId;
        case "artifact":
          return route.view === "artifact" && route.artifactId === notification.target.artifactId;
        default:
          return false;
      }
    },
    [route],
  );

  useEffect(() => {
    if (!ENABLE_THREAD_REPLY_NOTIFICATIONS) return;
    if (!selectedThreadId || !selectedThreadIsRunning) return;

    const sessionKey = resolveChatSessionKey(selectedThreadId, knownAgentIds.current);
    const trackers = backgroundRunTrackersRef.current;
    if (trackers.has(sessionKey)) return;

    const currentThread = threads.find((thread) => thread.id === selectedThreadId) as
      | ClawThread
      | undefined;
    trackers.set(sessionKey, {
      threadId: selectedThreadId,
      sessionKey,
      title: currentThread?.title ?? "Conversation",
      agentId: currentThread?.clawAgentId ?? selectedThreadId,
      baselineUpdatedAt: sessionMeta.get(sessionKey)?.updatedAt ?? 0,
      baselineNotificationIds: collectThreadNotificationIds(selectedThreadId, sessionKey),
      leftThread: !(route.view === "chat" && route.sessionId === selectedThreadId),
    });
  }, [
    collectThreadNotificationIds,
    knownAgentIds,
    route,
    selectedThreadId,
    selectedThreadIsRunning,
    sessionMeta,
    threads,
  ]);

  useEffect(() => {
    if (!ENABLE_THREAD_REPLY_NOTIFICATIONS) return;
    const trackers = backgroundRunTrackersRef.current;
    trackers.forEach((tracker) => {
      tracker.leftThread = !(route.view === "chat" && route.sessionId === tracker.threadId);
    });
  }, [route]);

  useEffect(() => {
    if (!ENABLE_THREAD_REPLY_NOTIFICATIONS) return;

    const trackers = backgroundRunTrackersRef.current;
    const completedTrackers = Array.from(trackers.entries()).filter(
      ([sessionKey, tracker]) =>
        (sessionMeta.get(sessionKey)?.updatedAt ?? 0) > tracker.baselineUpdatedAt,
    );

    if (completedTrackers.length === 0) return;

    const finalizeCompletedRuns = async () => {
      for (const [sessionKey, tracker] of completedTrackers) {
        trackers.delete(sessionKey);

        if (!tracker.leftThread) {
          continue;
        }

        const threadNotificationIds = collectThreadNotificationIds(tracker.threadId, sessionKey);
        const alreadyHasSpecificNotification = Array.from(threadNotificationIds).some(
          (id) => !tracker.baselineNotificationIds.has(id),
        );

        if (alreadyHasSpecificNotification) {
          continue;
        }

        const updatedAt = sessionMeta.get(sessionKey)?.updatedAt ?? Date.now();
        await onUpsertNotification({
          dedupeKey: `thread-reply:${tracker.threadId}:${updatedAt}`,
          kind: "thread_reply",
          title: tracker.title,
          message: "A background reply finished while you were away.",
          target: { view: "chat", sessionId: tracker.threadId },
          source: {
            agentId: tracker.agentId,
            sessionKey,
          },
        });
      }
    };

    void finalizeCompletedRuns();
  }, [collectThreadNotificationIds, onUpsertNotification, sessionMeta]);

  // Sync hash route → selected thread
  useEffect(() => {
    if (route.view === "chat" && route.sessionId !== selectedThreadId) {
      selectThread(route.sessionId);
    }
  }, [route, selectedThreadId, selectThread]);

  // Re-fetch history once the engine is actually connected.
  // The first selectThread fires before the engine exists (child effects
  // run before the parent's useGateway effect), so loadThread returns [].
  // When connectionState transitions to CONNECTED the engine is ready —
  // re-select the same thread to load real messages.
  const prevConnected = useRef(false);
  useEffect(() => {
    const justConnected = connectionState === ConnectionState.CONNECTED && !prevConnected.current;
    prevConnected.current = connectionState === ConnectionState.CONNECTED;
    if (justConnected && route.view === "chat" && route.sessionId === selectedThreadId) {
      selectThread(route.sessionId);
    }
  }, [connectionState, route, selectedThreadId, selectThread]);

  const handleRefineApp = useCallback(
    async (record: AppRecord) => {
      const nextThreadId = record.sessionKey
        ? sessionRouteIdFromSessionKey(record.sessionKey, knownAgentIds.current)
        : await createSession(record.agentId);
      if (!nextThreadId) return;

      onUpdateThreadWorkspace(nextThreadId, (current) => ({
        ...current,
        linkedApp: {
          appId: record.id,
          title: record.title,
          agentId: record.agentId,
          sessionKey: record.sessionKey,
        },
      }));
      onSetPendingPreviewOpen({
        threadId: nextThreadId,
        previewId: sessionAppPreviewId(record.id),
      });
      loadThreads();
      selectThread(nextThreadId);
      navigate({ view: "chat", sessionId: nextThreadId });
    },
    [
      createSession,
      knownAgentIds,
      loadThreads,
      onSetPendingPreviewOpen,
      onUpdateThreadWorkspace,
      selectThread,
    ],
  );

  /**
   * `ContinueConversation` from inside a standalone app view mirrors the
   * Refine flow: select the app's origin chat thread, pin the app as that
   * thread's `linkedApp` workspace context, open the app preview pane on
   * the right, navigate the URL to the chat view, and finally post the user
   * message via the chat store's `processMessage`. If the app doesn't carry
   * a known sessionKey, fall back to the currently selected thread rather
   * than silently dropping the user's click.
   */
  const handleAppContinueConversation = useCallback(
    async (payload: {
      message: { role: "user"; content: string };
      appRecord: AppRecord;
    }) => {
      const { appRecord, message } = payload;
      const nextThreadId = appRecord.sessionKey
        ? sessionRouteIdFromSessionKey(appRecord.sessionKey, knownAgentIds.current)
        : await createSession(appRecord.agentId);
      if (!nextThreadId) return;

      onUpdateThreadWorkspace(nextThreadId, (current) => ({
        ...current,
        linkedApp: {
          appId: appRecord.id,
          title: appRecord.title,
          agentId: appRecord.agentId,
          sessionKey: appRecord.sessionKey,
        },
      }));
      onSetPendingPreviewOpen({
        threadId: nextThreadId,
        previewId: sessionAppPreviewId(appRecord.id),
      });
      loadThreads();

      // Always navigate to the chat view. The user may already have
      // `selectedThreadId === nextThreadId` while viewing the app surface at
      // `#/apps/<id>` — in that case skipping `navigate` would leave them
      // stuck on the app route even though we've just posted a message.
      selectThread(nextThreadId);
      navigate({ view: "chat", sessionId: nextThreadId });

      // Zustand's set is synchronous, so processMessage sees the new
      // selectedThreadId on the very next call.
      dispatchChatProcessMessage(message);
    },
    [
      createSession,
      dispatchChatProcessMessage,
      knownAgentIds,
      loadThreads,
      onSetPendingPreviewOpen,
      onUpdateThreadWorkspace,
      selectThread,
    ],
  );

  const openNotification = useCallback(
    async (notification: NotificationRecord) => {
      switch (notification.target.view) {
        case "chat":
          navigate({ view: "chat", sessionId: notification.target.sessionId });
          break;
        case "app":
          navigate({ view: "app", appId: notification.target.appId });
          break;
        case "artifact":
          navigate({ view: "artifact", artifactId: notification.target.artifactId });
          break;
        default:
          navigate({ view: "home" });
          break;
      }

      if (notification.unread) {
        await onMarkNotificationsRead([notification.id]);
      }
    },
    [onMarkNotificationsRead],
  );

  useEffect(() => {
    if (!notificationsPrimedRef.current) {
      notificationsPrimedRef.current = true;
      notificationIdsRef.current = new Set(notifications.map((notification) => notification.id));
      return;
    }

    const nextIds = new Set(notifications.map((notification) => notification.id));
    const newUnreadNotifications = notifications.filter(
      (notification) =>
        notification.unread &&
        !notificationIdsRef.current.has(notification.id) &&
        !notificationMatchesRoute(notification),
    );

    if (newUnreadNotifications.length > 0) {
      setToastNotices((current) => {
        const existingNotificationIds = new Set(current.map((toast) => toast.notification.id));
        const additions = newUnreadNotifications
          .filter((notification) => !existingNotificationIds.has(notification.id))
          .map((notification) => ({
            id: `toast:${notification.id}`,
            notification,
          }));

        return [...current, ...additions].slice(-4);
      });
    }

    notificationIdsRef.current = nextIds;
  }, [notificationMatchesRoute, notifications]);

  useEffect(() => {
    if (toastNotices.length === 0) return;

    const timers = toastNotices.map((toast) =>
      window.setTimeout(() => {
        setToastNotices((current) => current.filter((candidate) => candidate.id !== toast.id));
      }, 5000),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toastNotices]);

  useEffect(() => {
    const ids = notifications
      .filter((notification) => {
        if (!notification.unread) return false;
        return notificationMatchesRoute(notification);
      })
      .map((notification) => notification.id);

    if (ids.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      void onMarkNotificationsRead(ids);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [notificationMatchesRoute, notifications, onMarkNotificationsRead]);

  let mainContent: React.ReactNode;
  if (route.view === "home") {
    mainContent = (
      <div className="flex h-full min-w-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <HomeDashboard
            threads={threads}
            apps={appList}
            artifacts={artifactList}
            notifications={notifications}
            cronJobs={cronJobs}
            cronRuns={cronRuns}
            cronStatus={cronStatus}
            pinnedAppIds={pinnedAppIds}
            onOpenThread={(threadId) => navigate({ view: "chat", sessionId: threadId })}
            onOpenApp={(appId) => navigate({ view: "app", appId })}
            onOpenArtifact={(artifactId) => navigate({ view: "artifact", artifactId })}
            onOpenNotifications={() => setMobileNotificationInboxOpen(true)}
          />
        </div>
        {notificationPaneCollapsed ? (
          <div className="hidden h-full w-14 shrink-0 border-l border-zinc-200/70 bg-gradient-to-b from-white/95 via-white/90 to-sky-50/35 dark:border-zinc-800 dark:from-zinc-950/92 dark:via-zinc-950/82 dark:to-sky-950/25 xl:flex">
            <button
              type="button"
              className="m-2 flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={() => setNotificationPaneCollapsed(false)}
              aria-label="Expand notifications"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <NotificationInboxPane
            notifications={notifications}
            onCollapse={() => setNotificationPaneCollapsed(true)}
            onMarkAllRead={async () => {
              await onMarkNotificationsRead();
            }}
            onOpenNotification={openNotification}
          />
        )}
        <NotificationInboxDrawer
          open={mobileNotificationInboxOpen}
          onClose={() => setMobileNotificationInboxOpen(false)}
          notifications={notifications}
          onMarkAllRead={async () => {
            await onMarkNotificationsRead();
          }}
          onOpenNotification={async (notification) => {
            setMobileNotificationInboxOpen(false);
            await openNotification(notification);
          }}
        />
      </div>
    );
  } else if (route.view === "artifacts" && artifacts) {
    mainContent = (
      <Shell.ThreadContainer>
        <ArtifactsView artifacts={artifacts} />
      </Shell.ThreadContainer>
    );
  } else if (route.view === "artifact" && artifacts) {
    mainContent = (
      <Shell.ThreadContainer>
        <ArtifactDetail
          artifactId={route.artifactId}
          artifacts={artifacts}
          updatedAt={activeArtifactUpdatedAt}
          onDeleted={onRefreshArtifacts}
        />
      </Shell.ThreadContainer>
    );
  } else if (route.view === "app" && apps) {
    mainContent = (
      <Shell.ThreadContainer>
        <AppDetail
          appId={route.appId}
          apps={apps}
          updatedAt={activeAppUpdatedAt}
          isPinned={pinnedAppIds.has(route.appId)}
          onTogglePinned={onTogglePinned}
          onRefine={handleRefineApp}
          onContinueConversation={handleAppContinueConversation}
          onDeleted={() => {
            onRefreshApps();
            navigate({ view: "home" });
          }}
        />
      </Shell.ThreadContainer>
    );
  } else {
    mainContent = (
      <ThreadArea
        sessionMeta={sessionMeta}
        availableModels={availableModels}
        patchSession={patchSession}
        resetSession={resetSession}
        compactSession={compactSession}
        onSessionChanged={onSessionChanged}
        loadThread={loadThread}
        knownAgentIds={knownAgentIds}
        appList={appList}
        artifactList={artifactList}
        apps={apps}
        artifacts={artifacts}
        uploads={uploads}
        pinnedAppIds={pinnedAppIds}
        onTogglePinned={onTogglePinned}
        workspaceByThread={workspaceByThread}
        onUpdateThreadWorkspace={onUpdateThreadWorkspace}
        onMarkUploadsSent={onMarkUploadsSent}
        onRemoveUpload={onRemoveUpload}
        onRefreshDurables={() => {
          onRefreshApps();
          onRefreshArtifacts();
        }}
        onRefreshSummaries={() => {
          onRefreshApps();
          onRefreshArtifacts();
          void onRefreshNotifications();
          void onRefreshCronData();
        }}
        pendingPreviewOpen={pendingPreviewOpen}
        onConsumePendingPreview={onConsumePendingPreview}
        onRefineApp={handleRefineApp}
        onAppContinueConversation={handleAppContinueConversation}
        workspacePaneCollapsed={workspacePaneCollapsed}
        onToggleWorkspacePaneCollapsed={setWorkspacePaneCollapsed}
        gatewayCommands={gatewayCommands}
      />
    );
  }

  return (
    <Shell.Container agentName="Claw" logoUrl={LOGO_URL}>
      <AppSidebar
        connectionState={connectionState}
        onSettingsClick={onSettingsClick}
        createSession={createSession}
        renameSession={renameSession}
        deleteSession={deleteSession}
        apps={appList}
        artifacts={artifactList}
        unreadNotificationCount={unreadNotificationCount}
        hiddenThreadIds={hiddenRefinementThreadIds}
        pinnedAppIds={pinnedAppIds}
        onTogglePinned={onTogglePinned}
        onDeleteApp={onDeleteApp}
      />
      {mainContent}
      <NotificationToastViewport
        toasts={toastNotices}
        onDismiss={(toastId) => {
          setToastNotices((current) => current.filter((toast) => toast.id !== toastId));
        }}
        onOpen={(notification, toastId) => {
          setToastNotices((current) => current.filter((toast) => toast.id !== toastId));
          void openNotification(notification);
        }}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        threads={threads as unknown as ClawThreadListItem[]}
        apps={appList}
        artifacts={artifactList}
        onTarget={(target) => {
          if (target.kind === "thread") {
            navigate({ view: "chat", sessionId: target.threadId });
          } else if (target.kind === "app") {
            navigate({ view: "app", appId: target.appId });
          } else if (target.kind === "artifact") {
            navigate({ view: "artifact", artifactId: target.artifactId });
          } else if (target.kind === "command") {
            // Focus the composer and prime it with the command. If user isn't
            // in a chat, drop them into the home route first so the composer
            // is visible.
            if (route.view !== "chat") navigate({ view: "home" });
            const evt = new CustomEvent("openui-claw:prime-composer", {
              detail: { text: `/${target.command.name} ` },
            });
            window.dispatchEvent(evt);
          }
        }}
      />
    </Shell.Container>
  );
}

export default function ChatApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appList, setAppList] = useState<AppSummary[]>([]);
  const [artifactList, setArtifactList] = useState<ArtifactSummary[]>([]);
  const [pinnedAppIds, setPinnedAppIds] = useState<Set<string>>(new Set());
  const [workspaceByThread, setWorkspaceByThread] = useState<Record<string, ThreadWorkspaceState>>(
    {},
  );
  const [pendingPreviewOpen, setPendingPreviewOpen] = useState<{
    threadId: string;
    previewId: string;
  } | null>(null);

  const {
    connectionState,
    pairingDeviceId,
    settings,
    processMessage,
    fetchThreadList,
    loadThread,
    createSession,
    deleteSession,
    renameSession,
    reconnect,
    sessionMeta,
    availableModels,
    patchSession,
    resetSession,
    compactSession,
    knownAgentIds,
    artifacts,
    apps,
    uploads,
    notifications,
    refreshNotifications,
    markNotificationsRead,
    upsertNotification,
    cronJobs,
    cronRuns,
    cronStatus,
    refreshCronData,
    gatewayCommands,
    onSessionChanged,
  } = useGateway({ onAuthFailed: () => setSettingsOpen(true) });

  const refreshAppList = useCallback(async () => {
    if (!apps) return;
    const list = await apps.listApps();
    const hydrated = await Promise.all(
      list.map(async (app) => {
        if (app.sessionKey) return app;
        const full = await apps.getApp(app.id);
        return {
          ...app,
          sessionKey: full?.sessionKey ?? "",
        };
      }),
    );
    setAppList(hydrated);
  }, [apps]);

  const refreshArtifactList = useCallback(async () => {
    if (!artifacts) return;
    const list = await artifacts.listArtifacts();
    setArtifactList(list);
  }, [artifacts]);

  useEffect(() => {
    if (apps) void refreshAppList();
  }, [apps, refreshAppList]);

  useEffect(() => {
    if (artifacts) void refreshArtifactList();
  }, [artifacts, refreshArtifactList]);

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      void refreshNotifications();
      void refreshCronData();
    }
  }, [connectionState, refreshCronData, refreshNotifications]);

  const handleDeleteApp = useCallback(
    async (appId: string) => {
      await apps?.deleteApp(appId);
      void refreshAppList();
    },
    [apps, refreshAppList],
  );

  // Auto-open settings on first visit (no gateway URL configured)
  useEffect(() => {
    if (!getSettings()?.gatewayUrl) setSettingsOpen(true);
  }, []);

  useEffect(() => {
    setPinnedAppIds(new Set(loadPinnedAppIds()));
  }, []);

  const adaptedFetchThreadList = useCallback(async (): Promise<{
    threads: Thread[];
  }> => {
    const rows = await fetchThreadList();
    return {
      threads: rows.map(toThreadRow),
    };
  }, [fetchThreadList]);

  // Stable ref so adaptedLoadThread's async listUploads picks up the latest
  // engine store even when the engine connects after ChatProvider mounts.
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const adaptedLoadThread = useCallback(
    async (threadId: string): Promise<Message[]> => {
      const msgs = await loadThread(threadId);
      const historyWorkspace = deriveThreadWorkspaceFromMessages(msgs);

      // Hydrate sent uploads from the plugin (server-authoritative). Resolve
      // the sessionKey first — the raw threadId may be an agent id that
      // resolveChatSessionKey expands to `agent:<id>:main:openui-claw`.
      let remoteUploads: ThreadUpload[] = [];
      const uploadsStore = uploadsRef.current;
      if (uploadsStore) {
        const scopedSessionKey = resolveChatSessionKey(threadId, knownAgentIds.current);
        try {
          const metas = await uploadsStore.listUploads(scopedSessionKey);
          remoteUploads = metas.map(uploadMetaToThreadUpload);
        } catch (error) {
          console.warn("[claw] uploads.list failed:", error);
        }
      }

      setWorkspaceByThread((current) => {
        const existingPending = (current[threadId]?.uploads ?? []).filter(
          (upload) => upload.status === "pending",
        );
        return {
          ...current,
          [threadId]: {
            uploads: [...remoteUploads, ...existingPending],
            linkedApp: historyWorkspace.linkedApp,
          },
        };
      });

      const result: Message[] = [];
      for (const m of msgs) {
        if (m.role === "assistant") {
          result.push({
            id: m.id,
            role: "assistant" as const,
            content: serializeAssistantTimelineContent({
              text: m.content ?? undefined,
              timeline:
                m.timeline ??
                (m.reasoning
                  ? [
                      {
                        type: "reasoning" as const,
                        text: m.reasoning,
                      },
                    ]
                  : []),
            }),
            ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
          });
        } else if (m.role === "activity") {
          result.push({
            id: m.id,
            role: "activity" as const,
            activityType: m.activityType,
            content: m.content,
          });
        } else {
          result.push({ id: m.id, role: m.role, content: m.content });
        }
      }
      return result as Message[];
    },
    [loadThread],
  );

  const togglePinnedApp = useCallback((appId: string) => {
    setPinnedAppIds((current) => {
      const next = new Set(current);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      savePinnedAppIds(next);
      return next;
    });
  }, []);

  const updateThreadWorkspace = useCallback(
    (threadId: string, updater: (current: ThreadWorkspaceState) => ThreadWorkspaceState) => {
      setWorkspaceByThread((current) => ({
        ...current,
        [threadId]: updater(current[threadId] ?? EMPTY_THREAD_WORKSPACE),
      }));
    },
    [],
  );

  const markUploadsSent = useCallback(
    (threadId: string, uploadIds: string[]) => {
      updateThreadWorkspace(threadId, (current) => ({
        ...current,
        uploads: current.uploads.map((upload) =>
          uploadIds.includes(upload.id) ? { ...upload, status: "sent" } : upload,
        ),
      }));
    },
    [updateThreadWorkspace],
  );

  const removeUpload = useCallback(
    (threadId: string, uploadId: string) => {
      // Look up remoteId from current state BEFORE we remove the entry. Reading
      // it inside the state updater is racy — React may batch the updater run
      // after the outer function returns, so the fire-and-forget delete below
      // would read `undefined` and skip the server-side cleanup.
      const target = workspaceByThread[threadId]?.uploads.find((upload) => upload.id === uploadId);
      const removedRemoteId = target?.remoteId;
      updateThreadWorkspace(threadId, (current) => ({
        ...current,
        uploads: current.uploads.filter((upload) => upload.id !== uploadId),
      }));
      if (uploads && removedRemoteId) {
        void uploads.deleteUpload(removedRemoteId).catch((error) => {
          console.warn("[claw] uploads.delete failed:", error);
        });
      }
    },
    [updateThreadWorkspace, uploads, workspaceByThread],
  );

  return (
    <ThemeProvider>
      <ChatProvider
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetchThreadList={adaptedFetchThreadList as any}
        loadThread={adaptedLoadThread}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        processMessage={processMessage as any}
        streamProtocol={openClawAdapter()}
      >
        <ChatAppInner
          connectionState={connectionState}
          onSettingsClick={() => setSettingsOpen(true)}
          createSession={createSession}
          renameSession={renameSession}
          deleteSession={deleteSession}
          resetSession={resetSession}
          compactSession={compactSession}
          onSessionChanged={onSessionChanged}
          loadThread={adaptedLoadThread}
          sessionMeta={sessionMeta}
          availableModels={availableModels}
          patchSession={patchSession}
          knownAgentIds={knownAgentIds}
          artifacts={artifacts}
          apps={apps}
          uploads={uploads}
          appList={appList}
          artifactList={artifactList}
          pinnedAppIds={pinnedAppIds}
          onTogglePinned={togglePinnedApp}
          workspaceByThread={workspaceByThread}
          onUpdateThreadWorkspace={updateThreadWorkspace}
          onMarkUploadsSent={markUploadsSent}
          onRemoveUpload={removeUpload}
          pendingPreviewOpen={pendingPreviewOpen}
          onSetPendingPreviewOpen={setPendingPreviewOpen}
          onConsumePendingPreview={() => setPendingPreviewOpen(null)}
          onDeleteApp={handleDeleteApp}
          onRefreshApps={refreshAppList}
          onRefreshArtifacts={refreshArtifactList}
          notifications={notifications}
          onMarkNotificationsRead={markNotificationsRead}
          onRefreshNotifications={refreshNotifications}
          onUpsertNotification={upsertNotification}
          cronJobs={cronJobs}
          cronRuns={cronRuns}
          cronStatus={cronStatus}
          onRefreshCronData={refreshCronData}
          gatewayCommands={gatewayCommands}
        />

        <SettingsDialog
          open={settingsOpen}
          currentSettings={settings}
          onClose={() => {
            if (getSettings()?.gatewayUrl) setSettingsOpen(false);
          }}
          onSave={(newSettings) => {
            reconnect(newSettings);
            setSettingsOpen(false);
          }}
        />

        {connectionState === ConnectionState.PAIRING && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 text-center">
              <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Device Pairing Required
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                This device needs to be approved on your server before it can connect.
              </p>
              <div className="relative group">
                <code className="block px-3 py-2 pr-10 bg-zinc-100 dark:bg-zinc-800 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all select-all text-left">
                  openclaw devices approve {pairingDeviceId}
                </code>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(`openclaw devices approve ${pairingDeviceId}`);
                  }}
                  title="Copy to clipboard"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
                Retrying automatically&hellip;
              </p>
            </div>
          </div>
        )}
      </ChatProvider>
    </ThemeProvider>
  );
}

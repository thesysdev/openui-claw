"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatProvider,
  useActiveArtifact,
  useArtifactStore,
  useThread,
  useThreadList,
} from "@openuidev/react-headless";
import type { Message, Thread } from "@openuidev/react-headless";
import { Shell, ThemeProvider } from "@openuidev/react-ui";
import { useGateway, resolveChatSessionKey } from "@/lib/chat/useGateway";
import { ConnectionState } from "@/lib/gateway/types";
import { openClawAdapter } from "@/lib/chat/openClawAdapter";
import { AssistantMessage } from "@/components/rendering/AssistantMessage";
import { UserMessage } from "@/components/rendering/UserMessage";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ComposerToolbar } from "@/components/session/SessionControls";
import { SessionComposer } from "@/components/session/SessionComposer";
import {
  SessionWorkspaceDrawer,
  SessionWorkspacePane,
} from "@/components/session/SessionWorkspacePane";
import { SessionPreviewPanels } from "@/components/session/SessionPreviewPanels";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";
import { ArtifactDetail } from "@/components/artifacts/ArtifactDetail";
import { AppDetail } from "@/components/apps/AppDetail";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HomeNotificationPanel } from "@/components/home/HomeNotificationPanel";
import { BellRing, PanelRightOpen, X } from "lucide-react";
import { useHashRoute, navigate } from "@/lib/hooks/useHashRoute";
import { loadPinnedAppIds, savePinnedAppIds } from "@/lib/app-pins";
import { getSettings } from "@/lib/storage";
import type { ClawThreadListItem, SessionRow, ModelChoice } from "@/types/gateway-responses";
import type {
  AppRecord,
  ArtifactStore,
  ArtifactSummary,
  AppStore,
  AppSummary,
} from "@/lib/engines/types";
import type { ClawThread } from "@/types/claw-thread";
import {
  EMPTY_THREAD_WORKSPACE,
  deriveThreadWorkspaceFromMessages,
  fileToThreadUpload,
  mergeThreadWorkspaces,
  sessionAppPreviewId,
  sessionArtifactPreviewId,
  sessionUploadPreviewId,
  type ThreadWorkspaceState,
} from "@/lib/session-workspace";
import {
  loadThreadWorkspaceCache,
  saveThreadWorkspaceCache,
} from "@/lib/thread-workspace-cache";
import { serializeAssistantTimelineContent } from "@/lib/chat/timeline";
import type { NotificationRecord } from "@/lib/notifications";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";

// Same default used by FullScreen — swap for a custom Claw logo later.
const LOGO_URL = "https://www.openui.com/favicon.svg";

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
  knownAgentIds,
  appList,
  artifactList,
  apps,
  artifacts,
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
  workspacePaneCollapsed,
  onToggleWorkspacePaneCollapsed,
}: {
  sessionMeta: Map<string, SessionRow>;
  availableModels: ModelChoice[];
  patchSession: (key: string, patch: Record<string, unknown>) => Promise<boolean>;
  knownAgentIds: React.RefObject<Set<string>>;
  appList: AppSummary[];
  artifactList: ArtifactSummary[];
  apps: AppStore | undefined;
  artifacts: ArtifactStore | undefined;
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
  workspacePaneCollapsed: boolean;
  onToggleWorkspacePaneCollapsed: (collapsed: boolean) => void;
}) {
  const { selectedThreadId } = useThreadList();
  const isRunning = useThread((state) => state.isRunning);
  const artifactStore = useArtifactStore();
  const { activeArtifactId } = useActiveArtifact();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousRunningRef = useRef(false);
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
    (selectedThreadId ? workspaceByThread[selectedThreadId] : undefined) ??
    EMPTY_THREAD_WORKSPACE;

  const sessionApps = useMemo(
    () =>
      sessionKey
        ? appList.filter((app) => app.sessionKey === sessionKey)
        : [],
    [appList, sessionKey],
  );

  const sessionArtifacts = useMemo(
    () =>
      sessionKey
        ? artifactList.filter((artifact) => artifact.source.sessionId === sessionKey)
        : [],
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
    if (
      autoPreviewStateRef.current &&
      autoPreviewStateRef.current.threadId !== selectedThreadId
    ) {
      autoPreviewStateRef.current = null;
    }
  }, [selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId || !isRunning) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const refreshLoop = async () => {
      await onRefreshDurables();
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
      artifactStore
        .getState()
        .openArtifact(sessionArtifactPreviewId(nextArtifact.id));
      return;
    }

    const nextApp = sessionApps.find(
      (app) =>
        !tracker.baselineAppIds.has(app.id) &&
        !tracker.openedAppIds.has(app.id),
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

      const uploads = await Promise.all(files.map((file) => fileToThreadUpload(file)));
      onUpdateThreadWorkspace(selectedThreadId, (current) => ({
        ...current,
        uploads: [...current.uploads, ...uploads],
      }));
      event.target.value = "";
    },
    [onUpdateThreadWorkspace, selectedThreadId],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
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
          <Shell.Messages assistantMessage={AssistantMessage} userMessage={UserMessage as any} loader={<Shell.MessageLoading />} />
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
        />
        <SessionPreviewPanels
          apps={sessionApps}
          allApps={appList}
          linkedApp={workspace.linkedApp}
          artifacts={sessionArtifacts}
          uploads={workspace.uploads}
          appStore={apps}
          artifactStore={artifacts}
          pinnedAppIds={pinnedAppIds}
          onTogglePinned={onTogglePinned}
          onRefineApp={onRefineApp}
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
          onOpenApp={(appId) =>
            artifactStore.getState().openArtifact(sessionAppPreviewId(appId))
          }
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
  );
}

interface ChatAppInnerProps {
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  createSession: (agentId: string) => Promise<string | null>;
  renameSession: (threadId: string, label: string) => Promise<boolean>;
  deleteSession: (threadId: string) => Promise<boolean>;
  sessionMeta: Map<string, SessionRow>;
  availableModels: ModelChoice[];
  patchSession: (key: string, patch: Record<string, unknown>) => Promise<boolean>;
  knownAgentIds: React.RefObject<Set<string>>;
  artifacts: ArtifactStore | undefined;
  apps: AppStore | undefined;
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
    notification: Omit<
      NotificationRecord,
      "id" | "createdAt" | "updatedAt" | "unread" | "readAt"
    >,
  ) => Promise<boolean>;
  cronJobs: CronJobRecord[];
  cronRuns: CronRunEntry[];
  cronStatus: CronStatusRecord | null;
  onRefreshCronData: () => Promise<{
    jobs: CronJobRecord[];
    runs: CronRunEntry[];
    status: CronStatusRecord | null;
  }>;
}

function ChatAppInner({
  connectionState,
  onSettingsClick,
  createSession,
  renameSession,
  deleteSession,
  sessionMeta,
  availableModels,
  patchSession,
  knownAgentIds,
  artifacts,
  apps,
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
}: ChatAppInnerProps) {
  const route = useHashRoute() ?? { view: "home" as const };
  const { threads, selectedThreadId, selectThread, loadThreads } =
    useThreadList();
  const selectedThreadIsRunning = useThread((state) => state.isRunning);
  const [workspacePaneCollapsed, setWorkspacePaneCollapsed] = useState(false);
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
            if (
              notification.target.view === "chat" &&
              notification.target.sessionId === threadId
            ) {
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
      route.view === "app"
        ? appList.find((app) => app.id === route.appId)?.updatedAt
        : undefined,
    [appList, route],
  );

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
    if (!selectedThreadId || !selectedThreadIsRunning) return;

    const sessionKey = resolveChatSessionKey(selectedThreadId, knownAgentIds.current);
    const trackers = backgroundRunTrackersRef.current;
    if (trackers.has(sessionKey)) return;

    const currentThread = threads.find(
      (thread) => thread.id === selectedThreadId,
    ) as ClawThread | undefined;
    trackers.set(sessionKey, {
      threadId: selectedThreadId,
      sessionKey,
      title: currentThread?.title ?? "Conversation",
      agentId: currentThread?.clawAgentId ?? selectedThreadId,
      baselineUpdatedAt: sessionMeta.get(sessionKey)?.updatedAt ?? 0,
      baselineNotificationIds: collectThreadNotificationIds(selectedThreadId, sessionKey),
      leftThread:
        !(route.view === "chat" && route.sessionId === selectedThreadId),
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
    const trackers = backgroundRunTrackersRef.current;
    trackers.forEach((tracker) => {
      tracker.leftThread =
        !(route.view === "chat" && route.sessionId === tracker.threadId);
    });
  }, [route]);

  useEffect(() => {
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

        const threadNotificationIds = collectThreadNotificationIds(
          tracker.threadId,
          sessionKey,
        );
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
    const justConnected =
      connectionState === ConnectionState.CONNECTED && !prevConnected.current;
    prevConnected.current = connectionState === ConnectionState.CONNECTED;
    if (
      justConnected &&
      route.view === "chat" &&
      route.sessionId === selectedThreadId
    ) {
      selectThread(route.sessionId);
    }
  }, [connectionState, route, selectedThreadId, selectThread]);

  const handleRefineApp = useCallback(
    async (record: AppRecord) => {
      const nextThreadId = await createSession(record.agentId);
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
    [createSession, loadThreads, onSetPendingPreviewOpen, onUpdateThreadWorkspace, selectThread],
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
        const existingNotificationIds = new Set(
          current.map((toast) => toast.notification.id),
        );
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
        setToastNotices((current) =>
          current.filter((candidate) => candidate.id !== toast.id),
        );
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

    if (ids.length > 0) {
      void onMarkNotificationsRead(ids);
    }
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
          />
        </div>
        <HomeNotificationPanel
          notifications={notifications}
          onOpenNotification={openNotification}
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
        knownAgentIds={knownAgentIds}
        appList={appList}
        artifactList={artifactList}
        apps={apps}
        artifacts={artifacts}
        pinnedAppIds={pinnedAppIds}
        onTogglePinned={onTogglePinned}
        workspaceByThread={workspaceByThread}
        onUpdateThreadWorkspace={onUpdateThreadWorkspace}
        onMarkUploadsSent={onMarkUploadsSent}
        onRemoveUpload={onRemoveUpload}
        onRefreshDurables={async () => {
          await Promise.all([onRefreshApps(), onRefreshArtifacts()]);
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
        workspacePaneCollapsed={workspacePaneCollapsed}
        onToggleWorkspacePaneCollapsed={setWorkspacePaneCollapsed}
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
        notifications={notifications}
        unreadNotificationCount={unreadNotificationCount}
        pinnedAppIds={pinnedAppIds}
        onTogglePinned={onTogglePinned}
        onDeleteApp={onDeleteApp}
      />
      {mainContent}
      <NotificationToastViewport
        toasts={toastNotices}
        onDismiss={(toastId) => {
          setToastNotices((current) =>
            current.filter((toast) => toast.id !== toastId),
          );
        }}
        onOpen={(notification, toastId) => {
          setToastNotices((current) =>
            current.filter((toast) => toast.id !== toastId),
          );
          void openNotification(notification);
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
  const [workspaceByThread, setWorkspaceByThread] = useState<
    Record<string, ThreadWorkspaceState>
  >({});
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
    knownAgentIds,
    artifacts,
    apps,
    notifications,
    refreshNotifications,
    markNotificationsRead,
    upsertNotification,
    cronJobs,
    cronRuns,
    cronStatus,
    refreshCronData,
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
    [apps, refreshAppList]
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

  const adaptedLoadThread = useCallback(
    async (threadId: string): Promise<Message[]> => {
      const msgs = await loadThread(threadId);
      const historyWorkspace = deriveThreadWorkspaceFromMessages(msgs);
      const cachedWorkspace = await loadThreadWorkspaceCache(threadId);
      const mergedWorkspace = mergeThreadWorkspaces(historyWorkspace, cachedWorkspace);

      setWorkspaceByThread((current) => ({
        ...current,
        [threadId]: mergedWorkspace,
      }));
      void saveThreadWorkspaceCache(threadId, mergedWorkspace);

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
          result.push({ id: m.id, role: "activity" as const, activityType: m.activityType, content: m.content });
        } else {
          result.push({ id: m.id, role: m.role, content: m.content });
        }
      }
      return result as Message[];
    },
    [loadThread]
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
    (
      threadId: string,
      updater: (current: ThreadWorkspaceState) => ThreadWorkspaceState,
    ) => {
      let nextWorkspace: ThreadWorkspaceState = EMPTY_THREAD_WORKSPACE;
      setWorkspaceByThread((current) => ({
        ...current,
        [threadId]: (nextWorkspace = updater(
          current[threadId] ?? EMPTY_THREAD_WORKSPACE,
        )),
      }));
      queueMicrotask(() => {
        void saveThreadWorkspaceCache(threadId, nextWorkspace);
      });
    },
    [],
  );

  const markUploadsSent = useCallback((threadId: string, uploadIds: string[]) => {
    updateThreadWorkspace(threadId, (current) => ({
      ...current,
      uploads: current.uploads.map((upload) =>
        uploadIds.includes(upload.id) ? { ...upload, status: "sent" } : upload,
      ),
    }));
  }, [updateThreadWorkspace]);

  const removeUpload = useCallback(
    (threadId: string, uploadId: string) => {
      updateThreadWorkspace(threadId, (current) => ({
        ...current,
        uploads: current.uploads.filter((upload) => upload.id !== uploadId),
      }));
    },
    [updateThreadWorkspace],
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
          sessionMeta={sessionMeta}
          availableModels={availableModels}
          patchSession={patchSession}
          knownAgentIds={knownAgentIds}
          artifacts={artifacts}
          apps={apps}
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
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
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
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState } from "@/lib/gateway/types";
import { getSettings, saveSettings } from "@/lib/storage";
import type { Settings } from "@/lib/storage";
import { EventType } from "@openuidev/react-headless";
import type { ModelChoice, ClawThreadListItem, SessionRow } from "@/types/gateway-responses";
import {
  OpenClawEngine,
  resolveChatSessionKey,
} from "@/lib/engines/openclaw/OpenClawEngine";
import type { StoredMessage, ArtifactStore, AppStore } from "@/lib/engines/types";
import type { NotificationRecord } from "@/lib/notifications";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";
import { separateContentAndContext } from "@/lib/content-parser";
import { deriveTitleFromText, isOpaqueSessionTitle } from "@/lib/thread-titles";

export type { ClawThreadListItem } from "@/types/gateway-responses";
export type { SessionRow, ModelChoice } from "@/types/gateway-responses";
export { resolveChatSessionKey };

function extractUserMessageText(content: unknown): string {
  if (typeof content === "string") {
    return separateContentAndContext(content).content ?? "";
  }

  if (!Array.isArray(content)) return "";

  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const candidate = part as { type?: string; text?: unknown };
      return candidate.type === "text" && typeof candidate.text === "string"
        ? [candidate.text]
        : [];
    })
    .join(" ")
    .trim();
}

function deriveThreadTitleFromMessages(messages: unknown[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (!candidate || typeof candidate !== "object") continue;

    const messageLike = candidate as { role?: string; content?: unknown };
    if (messageLike.role !== "user") continue;

    const title = deriveTitleFromText(extractUserMessageText(messageLike.content));
    if (title) return title;
  }

  return null;
}

function sessionRouteIdFromSessionKey(
  sessionKey: string,
  knownAgentIds: Set<string>,
): string {
  for (const agentId of knownAgentIds) {
    if (resolveChatSessionKey(agentId, knownAgentIds) === sessionKey) {
      return agentId;
    }
  }

  return sessionKey;
}

export function useGateway({ onAuthFailed }: { onAuthFailed: () => void }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [settings, setSettings] = useState<Settings | null>(() => getSettings());
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<Map<string, SessionRow>>(
    () => new Map()
  );
  const [availableModels, setAvailableModels] = useState<ModelChoice[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactStore | undefined>(undefined);
  const [apps, setApps] = useState<AppStore | undefined>(undefined);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobRecord[]>([]);
  const [cronRuns, setCronRuns] = useState<CronRunEntry[]>([]);
  const [cronStatus, setCronStatus] = useState<CronStatusRecord | null>(null);

  const onAuthFailedRef = useRef(onAuthFailed);
  useEffect(() => {
    onAuthFailedRef.current = onAuthFailed;
  }, [onAuthFailed]);

  const knownAgentIds = useRef<Set<string>>(new Set());
  const attemptedAutoTitlesRef = useRef<Map<string, string>>(new Map());
  const engineRef = useRef<OpenClawEngine | null>(null);
  const sessionMetaRef = useRef(sessionMeta);

  useEffect(() => {
    sessionMetaRef.current = sessionMeta;
  }, [sessionMeta]);

  useEffect(() => {
    const s = getSettings();
    const engine = new OpenClawEngine(
      {
        id: "default",
        name: "Default",
        enabled: true,
        gatewayUrl: s?.gatewayUrl ?? "",
        token: s?.token,
        deviceToken: s?.deviceToken,
      },
      {
        onConnectionStateChange: setConnectionState,
        onPairingRequired: setPairingDeviceId,
        onAuthFailed: () => onAuthFailedRef.current(),
        onSettingsChanged: (updated) => {
          setSettings(updated);
          saveSettings(updated);
        },
        onSessionMetaChanged: setSessionMeta,
        onModelsChanged: setAvailableModels,
        onKnownAgentIdsChanged: (ids) => { knownAgentIds.current = ids; },
      }
    );
    engineRef.current = engine;
    setArtifacts(engine.artifacts);
    setApps(engine.apps);
    void engine.connect();
    return () => { void engine.disconnect(); };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconnect = useCallback((newSettings: Settings) => {
    engineRef.current?.reconnect(newSettings);
  }, []);

  const processMessage = useCallback(
    async (params: {
      messages: unknown[];
      abortController: AbortController;
      threadId?: string;
    }): Promise<Response> => {
      const { messages, abortController, threadId } = params;

      if (!threadId) {
        return new Response(
          JSON.stringify({
            type: EventType.RUN_ERROR,
            message: "No agent selected. Choose an agent from the sidebar.",
          }) + "\n",
          { status: 200, headers: { "Content-Type": "application/octet-stream" } }
        );
      }

      if (!engineRef.current) {
        return new Response(
          JSON.stringify({ type: EventType.RUN_ERROR, message: "Engine not initialized." }) + "\n",
          { status: 200, headers: { "Content-Type": "application/octet-stream" } }
        );
      }

      if (!knownAgentIds.current.has(threadId)) {
        const sessionKey = resolveChatSessionKey(threadId, knownAgentIds.current);
        const session = sessionMetaRef.current.get(sessionKey);
        const serverTitle =
          session?.label ?? session?.displayName ?? session?.derivedTitle ?? null;

        if (!serverTitle || isOpaqueSessionTitle(serverTitle, sessionKey)) {
          const derivedTitle = deriveThreadTitleFromMessages(messages);
          const labelAlreadyUsed =
            derivedTitle != null &&
            Array.from(sessionMetaRef.current.entries()).some(
              ([existingSessionKey, existingSession]) =>
                existingSessionKey !== sessionKey &&
                existingSession.label?.trim() === derivedTitle,
            );
          if (
            derivedTitle &&
            !labelAlreadyUsed &&
            attemptedAutoTitlesRef.current.get(sessionKey) !== derivedTitle
          ) {
            attemptedAutoTitlesRef.current.set(sessionKey, derivedTitle);
            void engineRef.current.patchSession(sessionKey, { label: derivedTitle });
          }
        }
      }

      return engineRef.current.sendMessage(threadId, messages, abortController);
    },
    []
  );

  const fetchThreadList = useCallback(
    async (): Promise<ClawThreadListItem[]> =>
      engineRef.current?.fetchThreadList() ?? [],
    []
  );

  const loadThread = useCallback(
    async (threadId: string): Promise<StoredMessage[]> =>
      engineRef.current?.loadHistory(threadId) ?? [],
    []
  );

  const createSession = useCallback(
    async (agentId: string): Promise<string | null> => {
      const session = await engineRef.current?.createSession(agentId);
      return session?.id ?? null;
    },
    []
  );

  const deleteSession = useCallback(
    async (threadId: string): Promise<boolean> =>
      engineRef.current?.deleteSession(threadId) ?? false,
    []
  );

  const renameSession = useCallback(
    async (threadId: string, label: string): Promise<boolean> => {
      try {
        await engineRef.current?.conversations.renameSession(threadId, label);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const patchSession = useCallback(
    async (sessionKey: string, patch: Record<string, unknown>): Promise<boolean> =>
      engineRef.current?.patchSession(sessionKey, patch) ?? false,
    []
  );

  const refreshNotifications = useCallback(async (): Promise<NotificationRecord[]> => {
    const next = await engineRef.current?.listNotifications();
    const list = next ?? [];
    setNotifications(list);
    return list;
  }, []);

  const markNotificationsRead = useCallback(
    async (ids?: string[]): Promise<boolean> => {
      const ok = await engineRef.current?.markNotificationsRead(ids);
      if (ok) {
        await refreshNotifications();
      }
      return ok ?? false;
    },
    [refreshNotifications],
  );

  const upsertNotification = useCallback(
    async (
      notification: Omit<
        NotificationRecord,
        "id" | "createdAt" | "updatedAt" | "unread" | "readAt"
      >,
    ): Promise<boolean> => {
      const ok = await engineRef.current?.upsertNotification(notification);
      if (ok) {
        await refreshNotifications();
      }
      return ok ?? false;
    },
    [refreshNotifications],
  );

  const syncCronNotifications = useCallback(
    async (runs: CronRunEntry[]): Promise<void> => {
      const engine = engineRef.current;
      if (!engine) return;
      const existingNotifications = await engine.listNotifications();
      const existingDedupeKeys = new Set(
        (existingNotifications ?? [])
          .map((notification) => notification.dedupeKey)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      );

      const relevantRuns = runs
        .filter(
          (run) =>
            run.status === "error" ||
            run.status === "skipped" ||
            (run.status === "ok" && typeof run.summary === "string" && run.summary.length > 0),
        )
        .slice(0, 12);

      await Promise.all(
        relevantRuns.map(async (run) => {
          const dedupeKey = `cron-run:${run.jobId}:${run.ts}`;
          if (existingDedupeKeys.has(dedupeKey)) {
            return;
          }

          const threadId =
            run.threadId ??
            (run.sessionKey
              ? sessionRouteIdFromSessionKey(run.sessionKey, knownAgentIds.current)
              : undefined);

          const message =
            run.status === "error"
              ? run.error ?? "Scheduled run failed."
              : run.status === "skipped"
                ? run.summary ?? "Scheduled run was skipped."
                : run.summary ?? "Scheduled run completed.";

          await engine.upsertNotification({
            dedupeKey,
            kind: run.status === "ok" ? "cron_completed" : "cron_attention",
            title: run.jobName ?? run.jobId,
            message,
            target: threadId ? { view: "chat", sessionId: threadId } : { view: "home" },
            source: {
              cronId: run.jobId,
              sessionKey: run.sessionKey,
            },
            metadata: {
              status: run.status,
              summary: run.summary,
              error: run.error,
              deliveryStatus: run.deliveryStatus,
              runAtMs: run.runAtMs,
              nextRunAtMs: run.nextRunAtMs,
            },
          });
        }),
      );
    },
    [],
  );

  const refreshCronData = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) {
      setCronJobs([]);
      setCronRuns([]);
      setCronStatus(null);
      return { jobs: [], runs: [], status: null };
    }

    const [jobs, runs, status] = await Promise.all([
      engine.listCronJobs(),
      engine.listCronRuns(),
      engine.getCronStatus(),
    ]);

    const normalizedJobs = jobs
      .map((job) => ({
        ...job,
        threadId: job.sessionKey
          ? sessionRouteIdFromSessionKey(job.sessionKey, knownAgentIds.current)
          : undefined,
      }))
      .sort((left, right) => {
        const leftNext = left.state?.nextRunAtMs ?? Number.MAX_SAFE_INTEGER;
        const rightNext = right.state?.nextRunAtMs ?? Number.MAX_SAFE_INTEGER;
        return leftNext - rightNext;
      });

    const normalizedRuns = runs.map((run) => ({
      ...run,
      threadId: run.sessionKey
        ? sessionRouteIdFromSessionKey(run.sessionKey, knownAgentIds.current)
        : run.sessionId,
    }));

    setCronJobs(normalizedJobs);
    setCronRuns(normalizedRuns);
    setCronStatus(status);

    await syncCronNotifications(normalizedRuns);
    await refreshNotifications();

    return {
      jobs: normalizedJobs,
      runs: normalizedRuns,
      status,
    };
  }, [refreshNotifications, syncCronNotifications]);

  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshCronData();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [connectionState, refreshCronData]);

  return {
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
  };
}

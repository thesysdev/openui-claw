"use client";

import { separateContentAndContext } from "@/lib/content-parser";
import type { CronJobRecord, CronRunEntry, CronStatusRecord } from "@/lib/cron";
import { OpenClawEngine, resolveChatSessionKey } from "@/lib/engines/openclaw/OpenClawEngine";
import type {
  AppStore,
  ArtifactStore,
  GatewayCommand,
  StoredMessage,
  UploadStore,
} from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";
import { shouldSurfaceNotification, type NotificationRecord } from "@/lib/notifications";
import type { Settings } from "@/lib/storage";
import { getSettings, saveSettings } from "@/lib/storage";
import { deriveTitleFromText, isOpaqueSessionTitle } from "@/lib/thread-titles";
import type { ClawThreadListItem, ModelChoice, SessionRow } from "@/types/gateway-responses";
import { EventType } from "@openuidev/react-headless";
import { useCallback, useEffect, useRef, useState } from "react";

export type { ClawThreadListItem, ModelChoice, SessionRow } from "@/types/gateway-responses";
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

export function sessionRouteIdFromSessionKey(
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
    ConnectionState.DISCONNECTED,
  );
  const [settings, setSettings] = useState<Settings | null>(() => getSettings());
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<Map<string, SessionRow>>(() => new Map());
  const [availableModels, setAvailableModels] = useState<ModelChoice[]>([]);
  const [gatewayDefaultModelId, setGatewayDefaultModelId] = useState<string | null>(null);
  const [agentModelById, setAgentModelById] = useState<Map<string, string>>(() => new Map());
  const [artifacts, setArtifacts] = useState<ArtifactStore | undefined>(undefined);
  const [apps, setApps] = useState<AppStore | undefined>(undefined);
  const [uploads, setUploads] = useState<UploadStore | undefined>(undefined);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobRecord[]>([]);
  const [cronRuns, setCronRuns] = useState<CronRunEntry[]>([]);
  const [cronStatus, setCronStatus] = useState<CronStatusRecord | null>(null);
  const [gatewayCommands, setGatewayCommands] = useState<GatewayCommand[]>([]);

  const onAuthFailedRef = useRef(onAuthFailed);
  useEffect(() => {
    onAuthFailedRef.current = onAuthFailed;
  }, [onAuthFailed]);

  const knownAgentIds = useRef<Set<string>>(new Set());
  const attemptedAutoTitlesRef = useRef<Map<string, string>>(new Map());
  const engineRef = useRef<OpenClawEngine | null>(null);
  const sessionMetaRef = useRef(sessionMeta);
  // Subscribers for `sessions.changed` broadcasts — populated by consumers
  // via `onSessionChanged(...)` and drained when the gateway fires an event.
  const sessionChangedListenersRef = useRef<Set<(sessionKey: string) => void>>(new Set());
  // Cron-event refresh plumbing. The engine fires `onCronChanged` from
  // `_handleEvent`, which schedules a debounced refetch. We can't reference
  // `refreshCronData` directly inside the engine callback (it isn't defined
  // yet), so a ref is the connector.
  const cronRefreshFnRef = useRef<(() => Promise<unknown>) | null>(null);
  const cronRefreshTimerRef = useRef<number | null>(null);

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
        onModelsChanged: (models, defaultId) => {
          setAvailableModels(models);
          setGatewayDefaultModelId(defaultId);
        },
        onAgentInfoChanged: (map) => {
          setAgentModelById(new Map(map));
        },
        onKnownAgentIdsChanged: (ids) => {
          knownAgentIds.current = ids;
        },
        onSessionChanged: (sessionKey) => {
          for (const listener of sessionChangedListenersRef.current) {
            try {
              listener(sessionKey);
            } catch (err) {
              console.warn("[claw] onSessionChanged listener threw:", err);
            }
          }
        },
        // Coalesce bursts: cron events can arrive in pairs (started → completed
        // within milliseconds). A short trailing debounce keeps refetch traffic
        // sane while still feeling instant in the UI.
        onCronChanged: () => {
          if (cronRefreshTimerRef.current !== null) return;
          cronRefreshTimerRef.current = window.setTimeout(() => {
            cronRefreshTimerRef.current = null;
            void cronRefreshFnRef.current?.().catch((err) => {
              console.warn("[claw] cron refresh after event failed:", err);
            });
          }, 150);
        },
      },
    );
    engineRef.current = engine;
    setArtifacts(engine.artifacts);
    setApps(engine.apps);
    setUploads(engine.uploads);
    void engine.connect();
    return () => {
      void engine.disconnect();
    };
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
          { status: 200, headers: { "Content-Type": "application/octet-stream" } },
        );
      }

      if (!engineRef.current) {
        return new Response(
          JSON.stringify({ type: EventType.RUN_ERROR, message: "Engine not initialized." }) + "\n",
          { status: 200, headers: { "Content-Type": "application/octet-stream" } },
        );
      }

      if (!knownAgentIds.current.has(threadId)) {
        const sessionKey = resolveChatSessionKey(threadId, knownAgentIds.current);
        const session = sessionMetaRef.current.get(sessionKey);
        const serverTitle = session?.label ?? session?.displayName ?? session?.derivedTitle ?? null;

        if (!serverTitle || isOpaqueSessionTitle(serverTitle, sessionKey)) {
          const derivedTitle = deriveThreadTitleFromMessages(messages);
          const labelAlreadyUsed =
            derivedTitle != null &&
            Array.from(sessionMetaRef.current.entries()).some(
              ([existingSessionKey, existingSession]) =>
                existingSessionKey !== sessionKey && existingSession.label?.trim() === derivedTitle,
            );
          if (
            derivedTitle &&
            !labelAlreadyUsed &&
            attemptedAutoTitlesRef.current.get(sessionKey) !== derivedTitle
          ) {
            // Mark optimistically *before* awaiting so we don't fire two
            // patches in parallel for the same title; clear on failure so a
            // retry isn't permanently blocked (B27 — was fire-and-forget).
            attemptedAutoTitlesRef.current.set(sessionKey, derivedTitle);
            engineRef.current
              .patchSession(sessionKey, { label: derivedTitle })
              .then((ok) => {
                if (!ok) attemptedAutoTitlesRef.current.delete(sessionKey);
              })
              .catch(() => {
                attemptedAutoTitlesRef.current.delete(sessionKey);
              });
          }
        }
      }

      return engineRef.current.sendMessage(threadId, messages, abortController);
    },
    [],
  );

  const fetchThreadList = useCallback(
    async (): Promise<ClawThreadListItem[]> => engineRef.current?.fetchThreadList() ?? [],
    [],
  );

  const loadThread = useCallback(
    async (threadId: string): Promise<StoredMessage[]> =>
      engineRef.current?.conversations.loadHistory(threadId) ?? [],
    [],
  );

  const createSession = useCallback(async (agentId: string): Promise<string | null> => {
    const session = await engineRef.current?.conversations.createSession(agentId);
    return session?.id ?? null;
  }, []);

  const deleteSession = useCallback(async (threadId: string): Promise<boolean> => {
    // `ConversationStore.deleteSession` returns `Promise<void>` and throws on
    // failure. Map to a boolean here for callers that branch on it.
    const store = engineRef.current?.conversations;
    if (!store) return false;
    try {
      await store.deleteSession(threadId);
      // Drop any auto-title dedup entry for this session so a future session
      // reusing the same key (rare, but the gateway has no global ban) can
      // re-derive its title (B25 — was leaking forever).
      const sessionKey = resolveChatSessionKey(threadId, knownAgentIds.current);
      attemptedAutoTitlesRef.current.delete(sessionKey);
      return true;
    } catch {
      return false;
    }
  }, []);

  const renameSession = useCallback(async (threadId: string, label: string): Promise<boolean> => {
    try {
      await engineRef.current?.conversations.renameSession(threadId, label);
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetSession = useCallback(
    async (sessionKey: string): Promise<boolean> =>
      engineRef.current?.resetSession(sessionKey) ?? false,
    [],
  );

  const compactSession = useCallback(
    async (sessionKey: string): Promise<boolean> =>
      engineRef.current?.compactSession(sessionKey) ?? false,
    [],
  );

  const patchSession = useCallback(
    async (sessionKey: string, patch: Record<string, unknown>): Promise<boolean> =>
      engineRef.current?.patchSession(sessionKey, patch) ?? false,
    [],
  );

  const refreshNotifications = useCallback(async (): Promise<NotificationRecord[]> => {
    const next = await engineRef.current?.listNotifications();
    const list = (next ?? []).filter(shouldSurfaceNotification);
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

  const syncCronNotifications = useCallback(async (runs: CronRunEntry[]): Promise<void> => {
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

        const message =
          run.status === "error"
            ? (run.error ?? "Scheduled run failed.")
            : run.status === "skipped"
              ? (run.summary ?? "Scheduled run was skipped.")
              : (run.summary ?? "Scheduled run completed.");

        await engine.upsertNotification({
          dedupeKey,
          kind: run.status === "ok" ? "cron_completed" : "cron_attention",
          title: run.jobName ?? run.jobId,
          message,
          // Route to the crons view (focused on this job) instead of a
          // synthetic chat sessionId — cron runs don't have a real chat
          // thread to open.
          target: { view: "crons", jobId: run.jobId },
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
  }, []);

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

  // Keep the engine-side cron callback pointing at the latest closure.
  useEffect(() => {
    cronRefreshFnRef.current = refreshCronData;
  }, [refreshCronData]);

  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) return;

    let intervalId: number | null = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      if (document.visibilityState === "hidden" || intervalId !== null) return;
      intervalId = window.setInterval(() => {
        void refreshCronData().catch((error) => {
          console.warn("[claw] cron refresh failed:", error);
        });
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
        return;
      }

      void refreshCronData().catch((error) => {
        console.warn("[claw] cron refresh failed:", error);
      });
      startPolling();
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connectionState, refreshCronData]);

  // Pull the gateway's native slash-command catalog + subscribe to
  // `sessions.changed` once per connect. Autocomplete needs the commands;
  // `sessions.changed` lets us know when a transcript mutated out of band
  // (subagent completions, external sessions.send, etc.) so we can re-fetch.
  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) {
      setGatewayCommands([]);
      return;
    }
    let cancelled = false;
    void engineRef.current
      ?.fetchGatewayCommands()
      .then((commands) => {
        if (!cancelled) setGatewayCommands(commands);
      })
      .catch((err) => console.warn("[claw] fetchGatewayCommands failed:", err));
    void engineRef.current?.subscribeSessions();
    return () => {
      cancelled = true;
    };
  }, [connectionState]);

  /** Subscribe to `sessions.changed` events for any session. Returns an
   *  unsubscribe function. Consumers typically filter on sessionKey to react
   *  only when their own thread changes. */
  const onSessionChanged = useCallback((listener: (sessionKey: string) => void) => {
    sessionChangedListenersRef.current.add(listener);
    return () => {
      sessionChangedListenersRef.current.delete(listener);
    };
  }, []);

  const listSkills = useCallback(
    async (agentId?: string) => engineRef.current?.skills?.status(agentId) ?? [],
    [],
  );
  const setSkillEnabled = useCallback(
    async (skillKey: string, enabled: boolean) =>
      engineRef.current?.skills?.setEnabled(skillKey, enabled) ?? false,
    [],
  );

  const updateCronJob = useCallback(
    async (id: string, patch: Record<string, unknown>) =>
      engineRef.current?.updateCronJob(id, patch) ?? false,
    [],
  );
  const runCronJob = useCallback(
    async (id: string, mode: "force" | "due" = "force") =>
      engineRef.current?.runCronJob(id, mode) ?? false,
    [],
  );
  const removeCronJob = useCallback(
    async (id: string) => engineRef.current?.removeCronJob(id) ?? false,
    [],
  );

  return {
    connectionState,
    pairingDeviceId,
    settings,
    processMessage,
    fetchThreadList,
    loadThread,
    createSession,
    deleteSession,
    resetSession,
    compactSession,
    renameSession,
    reconnect,
    sessionMeta,
    availableModels,
    gatewayDefaultModelId,
    agentModelById,
    patchSession,
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
    updateCronJob,
    runCronJob,
    removeCronJob,
    gatewayCommands,
    onSessionChanged,
    listSkills,
    setSkillEnabled,
  };
}

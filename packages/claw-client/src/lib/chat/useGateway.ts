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
import type { StoredMessage, ArtifactStore, AppStore, AppSummary } from "@/lib/engines/types";

export type { ClawThreadListItem } from "@/types/gateway-responses";
export type { SessionRow, ModelChoice } from "@/types/gateway-responses";
export { resolveChatSessionKey };

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

  const onAuthFailedRef = useRef(onAuthFailed);
  useEffect(() => {
    onAuthFailedRef.current = onAuthFailed;
  }, [onAuthFailed]);

  const knownAgentIds = useRef<Set<string>>(new Set());
  const engineRef = useRef<OpenClawEngine | null>(null);

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
  };
}

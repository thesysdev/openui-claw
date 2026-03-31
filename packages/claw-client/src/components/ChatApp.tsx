"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatProvider, useThreadList } from "@openuidev/react-headless";
import type { Message, Thread } from "@openuidev/react-headless";
import { Shell, ThemeProvider } from "@openuidev/react-ui";
import { useGateway, resolveChatSessionKey } from "@/lib/chat/useGateway";
import { ConnectionState } from "@/lib/gateway/types";
import { openClawAdapter } from "@/lib/chat/openClawAdapter";
import { AssistantMessage } from "@/components/rendering/AssistantMessage";
import { UserMessage } from "@/components/rendering/UserMessage";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ComposerToolbar } from "@/components/session/SessionControls";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { getSettings } from "@/lib/storage";
import type { ClawThreadListItem, SessionRow, ModelChoice } from "@/types/gateway-responses";

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

function ThreadArea({
  sessionMeta,
  availableModels,
  patchSession,
  knownAgentIds,
}: {
  sessionMeta: Map<string, SessionRow>;
  availableModels: ModelChoice[];
  patchSession: (key: string, patch: Record<string, unknown>) => Promise<boolean>;
  knownAgentIds: React.RefObject<Set<string>>;
}) {
  const { selectedThreadId } = useThreadList();

  const sessionKey = useMemo(() => {
    if (!selectedThreadId) return null;
    return resolveChatSessionKey(selectedThreadId, knownAgentIds.current);
  }, [selectedThreadId, knownAgentIds]);

  const meta = sessionKey ? sessionMeta.get(sessionKey) : undefined;

  return (
    <Shell.ThreadContainer>
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
      <Shell.Composer />
    </Shell.ThreadContainer>
  );
}

export default function ChatApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  } = useGateway({ onAuthFailed: () => setSettingsOpen(true) });

  // Auto-open settings on first visit (no gateway URL configured)
  useEffect(() => {
    if (!getSettings()?.gatewayUrl) setSettingsOpen(true);
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
      return msgs.map((m) => {
        if (m.role === "reasoning")
          return { id: m.id, role: "reasoning" as const, content: m.content };
        if (m.role === "activity")
          return { id: m.id, role: "activity" as const, activityType: m.activityType, content: m.content };
        return {
          id: m.id,
          role: m.role,
          content: m.content ?? undefined,
          ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
        };
      }) as Message[];
    },
    [loadThread]
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
        <Shell.Container agentName="Claw" logoUrl={LOGO_URL}>
          <AppSidebar
            connectionState={connectionState}
            onSettingsClick={() => setSettingsOpen(true)}
            createSession={createSession}
            renameSession={renameSession}
            deleteSession={deleteSession}
          />

          <ThreadArea
            sessionMeta={sessionMeta}
            availableModels={availableModels}
            patchSession={patchSession}
            knownAgentIds={knownAgentIds}
          />
        </Shell.Container>

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

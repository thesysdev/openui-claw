"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatProvider, useThreadList } from "@openuidev/react-headless";
import type { Message, Thread } from "@openuidev/react-headless";
import { Shell, ThemeProvider } from "@openuidev/react-ui";
import { useGateway, resolveChatSessionKey } from "@/lib/chat/useGateway";
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
      return msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? undefined,
        ...(m.toolCalls?.length ? { toolCalls: m.toolCalls } : {}),
      })) as Message[];
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
      </ChatProvider>
    </ThemeProvider>
  );
}

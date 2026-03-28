"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatProvider } from "@openuidev/react-headless";
import type { Message, Thread } from "@openuidev/react-headless";
import { Shell, ThemeProvider } from "@openuidev/react-ui";
import { useGateway } from "@/lib/chat/useGateway";
import { openClawAdapter } from "@/lib/chat/openClawAdapter";
import { AssistantMessage } from "@/components/rendering/AssistantMessage";
import { UserMessage } from "@/components/rendering/UserMessage";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { getSettings } from "@/lib/storage";

// Same default used by FullScreen — swap for a custom Claw logo later.
const LOGO_URL = "https://www.openui.com/favicon.svg";

export default function ChatApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { connectionState, settings, processMessage, fetchThreadList, loadThread, reconnect } =
    useGateway({ onAuthFailed: () => setSettingsOpen(true) });

  // Auto-open settings on first visit (no gateway URL configured)
  useEffect(() => {
    if (!getSettings()?.gatewayUrl) setSettingsOpen(true);
  }, []);

  // ChatProvider expects: (cursor?) => Promise<{ threads: Thread[]; nextCursor? }>
  const adaptedFetchThreadList = useCallback(async (): Promise<{
    threads: Thread[];
  }> => {
    const agents = await fetchThreadList();
    return {
      threads: agents.map((a) => ({
        id: a.id,
        title: a.title ?? a.id,
        createdAt: Date.now(),
      })),
    };
  }, [fetchThreadList]);

  // ChatProvider expects: (threadId) => Promise<Message[]>
  const adaptedLoadThread = useCallback(
    async (threadId: string): Promise<Message[]> => {
      const msgs = await loadThread(threadId);
      return msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? undefined,
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
          />

          <Shell.ThreadContainer>
            <Shell.MobileHeader />
            <Shell.ScrollArea>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Shell.Messages assistantMessage={AssistantMessage} userMessage={UserMessage as any} loader={<Shell.MessageLoading />} />
            </Shell.ScrollArea>
            <Shell.Composer />
          </Shell.ThreadContainer>
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

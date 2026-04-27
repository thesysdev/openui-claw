"use client";

import { Briefcase, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileDetailHeader } from "@/components/mobile/MobileDetailHeader";
import { MobileMenuDrawer } from "@/components/mobile/MobileMenuDrawer";
import { MobileSwitcherSheet } from "@/components/mobile/MobileSwitcherSheet";
import type { ClawThread } from "@/types/claw-thread";

export interface MobileAgentTopBarAgent {
  id: string;
  name: string;
}

export interface MobileAgentTopBarProps {
  agent: MobileAgentTopBarAgent;
  allAgents: MobileAgentTopBarAgent[];
  activeSession: { id: string; title: string };
  sessions: ClawThread[];
  onBack: () => void;
  onSwitchAgent: (agent: MobileAgentTopBarAgent) => void;
  onSelectSession: (threadId: string) => void;
  onNewSession: () => void;
  onOpenWorkspace: () => void;
  onDeleteSession?: () => void;
  onDeleteAgent?: () => void;
}

export function MobileAgentTopBar({
  agent,
  allAgents,
  activeSession,
  sessions,
  onBack,
  onSwitchAgent,
  onSelectSession,
  onNewSession,
  onOpenWorkspace,
  onDeleteSession,
  onDeleteAgent,
}: MobileAgentTopBarProps) {
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <MobileDetailHeader
        onBack={onBack}
        backLabel="Back"
        title={{
          label: agent.name,
          onTap: allAgents.length > 1 ? () => setAgentSheetOpen(true) : undefined,
        }}
        subtitle={{
          label: activeSession.title,
          onTap: sessions.length > 0 ? () => setSessionSheetOpen(true) : undefined,
        }}
        actions={
          <HeaderIconButton onClick={() => setMenuOpen(true)} label="Open menu">
            <MoreVertical size={18} />
          </HeaderIconButton>
        }
      />

      <MobileSwitcherSheet
        open={agentSheetOpen}
        onClose={() => setAgentSheetOpen(false)}
        title="Switch agent"
        activeId={agent.id}
        options={allAgents.map((a) => ({ id: a.id, label: a.name }))}
        onSelect={(id) => {
          const next = allAgents.find((a) => a.id === id);
          if (next) onSwitchAgent(next);
        }}
      />

      <MobileSwitcherSheet
        open={sessionSheetOpen}
        onClose={() => setSessionSheetOpen(false)}
        title="Switch session"
        activeId={activeSession.id}
        options={sessions.map((s) => ({ id: s.id, label: s.title }))}
        onSelect={(id) => onSelectSession(id)}
      />

      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={agent.name}
        items={[
          {
            key: "new-session",
            label: "New session",
            icon: Plus,
            onSelect: onNewSession,
          },
          {
            key: "workspace",
            label: "Workspace",
            icon: Briefcase,
            onSelect: onOpenWorkspace,
          },
          ...(onDeleteSession
            ? [
                {
                  key: "delete-session",
                  label: "Delete session",
                  icon: Trash2,
                  destructive: true,
                  onSelect: onDeleteSession,
                },
              ]
            : []),
          ...(onDeleteAgent
            ? [
                {
                  key: "delete-agent",
                  label: "Delete agent",
                  icon: Trash2,
                  destructive: true,
                  onSelect: onDeleteAgent,
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

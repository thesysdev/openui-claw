"use client";

import { ArrowLeft, Cpu, PanelRightOpen, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/chat/TopBar";
import type { ClawThread } from "@/types/claw-thread";

// ────────────────────────────────────────────────────────────────────────────
// Data shape
// ────────────────────────────────────────────────────────────────────────────

export interface AgentTopBarAgent {
  id: string;
  name: string;
}

export interface AgentTopBarProps {
  /** Current agent being shown in the chat. */
  agent: AgentTopBarAgent;
  /** All agents available for the switcher dropdown. */
  allAgents: AgentTopBarAgent[];
  /** Current session/thread. */
  activeSession: { id: string; title: string };
  /** Sessions under the current agent for the session dropdown. */
  sessions: ClawThread[];
  onBack?: () => void;
  onSwitchAgent: (agent: AgentTopBarAgent) => void;
  onSelectSession: (threadId: string) => void;
  onNewSession: () => void;
  /** Optional — renders a workspace toggle icon in the actions slot when provided. */
  onOpenWorkspace?: () => void;
  /** Compact icon-only "New session" trigger (used on mobile). */
  compactNewSession?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Dropdown helper — closes on outside-click + Escape.
// ────────────────────────────────────────────────────────────────────────────

function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, active]);
}

function PillButton({
  onClick,
  hovered,
  open,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  onClick: () => void;
  hovered: boolean;
  open: boolean;
  children: ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex h-7 items-center gap-xs rounded-m px-2xs transition-colors ${
        hovered || open
          ? "bg-sunk-light dark:bg-highlight-subtle"
          : "bg-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function DropdownPanel({
  children,
  width = 240,
}: {
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{ minWidth: width }}
      className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-border-default bg-popover-background p-3xs shadow-xl dark:bg-elevated"
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AgentSwitcher — name + chevron, dropdown lists every agent.
// ────────────────────────────────────────────────────────────────────────────

function AgentSwitcher({
  agent,
  allAgents,
  onSwitch,
}: {
  agent: AgentTopBarAgent;
  allAgents: AgentTopBarAgent[];
  onSwitch: (a: AgentTopBarAgent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <PillButton
        onClick={() => setOpen((o) => !o)}
        hovered={hover}
        open={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span className="font-body text-md font-medium text-text-neutral-primary">
          {agent.name}
        </span>
      </PillButton>
      {open ? (
        <DropdownPanel>
          {allAgents.map((a) => {
            const isActive = a.id === agent.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSwitch(a);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors ${
                  isActive
                    ? "bg-sunk-light dark:bg-highlight-subtle"
                    : "hover:bg-sunk-light dark:hover:bg-highlight-subtle"
                }`}
              >
                <Cpu
                  size={13}
                  className={
                    isActive
                      ? "text-text-neutral-primary"
                      : "text-text-neutral-tertiary"
                  }
                />
                <span
                  className={`flex-1 truncate font-body text-sm ${
                    isActive
                      ? "font-medium text-text-neutral-primary"
                      : "text-text-neutral-secondary"
                  }`}
                >
                  {a.name}
                </span>
              </button>
            );
          })}
        </DropdownPanel>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SessionSwitcher — active session title + chevron, dropdown with sessions.
// ────────────────────────────────────────────────────────────────────────────

function SessionSwitcher({
  activeSession,
  sessions,
  onSelect,
  onNewSession,
}: {
  activeSession: { id: string; title: string };
  sessions: ClawThread[];
  onSelect: (threadId: string) => void;
  onNewSession: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <PillButton
        onClick={() => setOpen((o) => !o)}
        hovered={hover}
        open={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span className="max-w-[120px] truncate font-body text-md font-regular text-text-neutral-secondary sm:max-w-[260px]">
          {activeSession.title}
        </span>
      </PillButton>
      {open ? (
        <DropdownPanel width={280}>
          {sessions.map((s) => {
            const isActive = s.id === activeSession.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-m px-s py-xs text-left transition-colors ${
                  isActive
                    ? "bg-sunk-light dark:bg-highlight-subtle"
                    : "hover:bg-sunk-light dark:hover:bg-highlight-subtle"
                }`}
              >
                <span
                  className={`flex-1 truncate font-body text-sm ${
                    isActive
                      ? "font-medium text-text-neutral-primary"
                      : "text-text-neutral-secondary"
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
          <div className="my-3xs h-px w-full bg-border-default/40" />
          <button
            type="button"
            onClick={() => {
              onNewSession();
              setOpen(false);
            }}
            className="flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors hover:bg-sunk-light dark:hover:bg-highlight-subtle"
          >
            <Plus size={13} className="text-text-neutral-tertiary" />
            <span className="font-body text-sm text-text-neutral-secondary">
              New session
            </span>
          </button>
        </DropdownPanel>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Public: the top bar itself.
// ────────────────────────────────────────────────────────────────────────────

export function AgentTopBar({
  agent,
  allAgents,
  activeSession,
  sessions,
  onBack,
  onSwitchAgent,
  onSelectSession,
  onNewSession,
  onOpenWorkspace,
  compactNewSession,
}: AgentTopBarProps) {
  return (
    <TopBar
      leading={
        onBack ? (
          <IconButton
            icon={ArrowLeft}
            variant={compactNewSession ? "tertiary" : "secondary"}
            size="md"
            title="Back"
            onClick={onBack}
          />
        ) : undefined
      }
      actions={
        <>
          {compactNewSession ? (
            <IconButton
              icon={Plus}
              variant="tertiary"
              size="md"
              title="New session"
              aria-label="New session"
              onClick={onNewSession}
            />
          ) : (
            <Button variant="tertiary" size="md" icon={Plus} onClick={onNewSession}>
              New session
            </Button>
          )}
          {onOpenWorkspace ? (
            <IconButton
              icon={PanelRightOpen}
              variant="tertiary"
              size="md"
              title="Open workspace"
              aria-label="Open workspace"
              onClick={onOpenWorkspace}
            />
          ) : null}
        </>
      }
    >
      <div className="flex min-w-0 items-center gap-xs">
        <AgentSwitcher agent={agent} allAgents={allAgents} onSwitch={onSwitchAgent} />
        <span
          aria-hidden="true"
          className="h-4 w-px shrink-0 bg-border-default dark:bg-border-default/16"
        />
        <SessionSwitcher
          activeSession={activeSession}
          sessions={sessions}
          onSelect={onSelectSession}
          onNewSession={onNewSession}
        />
      </div>
    </TopBar>
  );
}

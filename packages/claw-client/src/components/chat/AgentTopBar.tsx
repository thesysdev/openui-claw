"use client";

import { ArrowLeft, Cpu, PanelRightOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { TopBar } from "@/components/chat/TopBar";
import { IconButton } from "@/components/layout/sidebar/IconButton";
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
  /** All agents available — kept in the prop signature so callers don't have
   *  to change shape, but no longer surfaced in this top bar. Switch agents
   *  from the sidebar instead. */
  allAgents?: AgentTopBarAgent[];
  /** Current session/thread. */
  activeSession: { id: string; title: string };
  /** Sessions under the current agent — same note as `allAgents`. */
  sessions?: ClawThread[];
  onBack?: () => void;
  /** Kept for compatibility with existing callers; not used by the new UI. */
  onSwitchAgent?: (agent: AgentTopBarAgent) => void;
  /** Kept for compatibility with existing callers; not used by the new UI. */
  onSelectSession?: (threadId: string) => void;
  onNewSession: () => void;
  onRenameAgent?: (newName: string) => void | Promise<void>;
  onDeleteAgent?: () => void | Promise<void>;
  onRenameSession?: (newName: string) => void | Promise<void>;
  onDeleteSession?: () => void | Promise<void>;
  /**
   * When set, renders a workspace-toggle icon button in the actions strip.
   * Used on mobile (where the workspace pane is a drawer instead of a
   * permanent right-rail) so the user can open it from the chat header.
   */
  onOpenWorkspace?: () => void;
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

function DropdownPanel({ children, width = 200 }: { children: ReactNode; width?: number }) {
  return (
    <div
      style={{ minWidth: width }}
      className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-lg border border-border-default bg-popover-background p-3xs shadow-xl dark:bg-elevated"
    >
      {children}
    </div>
  );
}

interface MenuActionProps {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function MenuAction({ icon: Icon, label, onClick, destructive }: MenuActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors hover:bg-sunk-light dark:hover:bg-highlight-subtle ${
        destructive
          ? "text-text-danger-primary"
          : "text-text-neutral-secondary hover:text-text-neutral-primary"
      }`}
    >
      <Icon
        size={13}
        className={destructive ? "text-text-danger-primary" : "text-text-neutral-tertiary"}
      />
      <span className="font-body text-sm">{label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-3xs h-px w-full bg-border-default/40" />;
}

function MenuPeer({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon?: typeof Cpu;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors hover:bg-sunk-light dark:hover:bg-highlight-subtle"
    >
      {Icon ? <Icon size={13} className="text-text-neutral-tertiary" /> : null}
      <span className="min-w-0 flex-1 truncate font-body text-sm text-text-neutral-secondary">
        {label}
      </span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EditablePill — the trigger button. When `editing` is true it renders an
// inline `<input>` that auto-focuses and selects, commits on Enter / blur,
// cancels on Escape. Otherwise it shows the title and opens a dropdown of
// actions.
// ────────────────────────────────────────────────────────────────────────────

interface EditablePillProps {
  /** The displayed/edited label. */
  label: string;
  /** Tailwind classes for the visual variant (primary vs secondary text). */
  textClass: string;
  /** Open-state of the dropdown. */
  open: boolean;
  onToggleOpen: () => void;
  onCloseOpen: () => void;
  /** Open-state of the inline editor. */
  editing: boolean;
  /** Called when the user commits a non-empty new label. */
  onCommit: (next: string) => void;
  onCancelEdit: () => void;
  /** Optional class on the inner span for max-width / truncation. */
  innerClass?: string;
  /** Dropdown content. */
  children: ReactNode;
}

function EditablePill({
  label,
  textClass,
  open,
  onToggleOpen,
  onCloseOpen,
  editing,
  onCommit,
  onCancelEdit,
  innerClass,
  children,
}: EditablePillProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(label);
  // Keep the draft in sync with the label whenever editing toggles on.
  useLayoutEffect(() => {
    if (editing) {
      setDraft(label);
      // Defer to next tick so the input is mounted before we focus.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, label]);

  useOutsideClose(ref, onCloseOpen, open);

  const commit = () => {
    const next = draft.trim();
    if (next.length === 0 || next === label) {
      onCancelEdit();
      return;
    }
    onCommit(next);
  };

  return (
    <div ref={ref} className="relative">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          onBlur={commit}
          className={`flex h-7 items-center rounded-m border border-border-interactive-emphasis bg-background px-2xs font-body text-md font-medium text-text-neutral-primary outline-none ${innerClass ?? ""}`}
        />
      ) : (
        <button
          type="button"
          onClick={onToggleOpen}
          className={`flex h-7 items-center gap-xs rounded-m px-2xs transition-colors ${
            open
              ? "bg-sunk-light dark:bg-highlight-subtle"
              : "bg-transparent hover:bg-sunk-light dark:hover:bg-highlight-subtle"
          }`}
        >
          <span className={`${textClass} ${innerClass ?? ""}`}>{label}</span>
        </button>
      )}
      {open && !editing ? <DropdownPanel>{children}</DropdownPanel> : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// AgentSwitcher — actions menu for the current agent.
// ────────────────────────────────────────────────────────────────────────────

function AgentSwitcher({
  agent,
  peers,
  onSwitch,
  onRename,
  onDelete,
}: {
  agent: AgentTopBarAgent;
  peers: AgentTopBarAgent[];
  onSwitch?: (a: AgentTopBarAgent) => void;
  onRename?: (newName: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const otherAgents = peers.filter((a) => a.id !== agent.id);

  return (
    <EditablePill
      label={agent.name}
      textClass="font-body text-md font-medium text-text-neutral-primary"
      open={open}
      onToggleOpen={() => setOpen((o) => !o)}
      onCloseOpen={() => setOpen(false)}
      editing={editing}
      onCommit={(next) => {
        void onRename?.(next);
        setEditing(false);
      }}
      onCancelEdit={() => setEditing(false)}
    >
      {onRename ? (
        <MenuAction
          icon={Pencil}
          label="Rename agent"
          onClick={() => {
            setOpen(false);
            setEditing(true);
          }}
        />
      ) : null}
      {onDelete ? (
        <MenuAction
          icon={Trash2}
          label="Delete agent"
          destructive
          onClick={() => {
            setOpen(false);
            void onDelete();
          }}
        />
      ) : null}
      {onSwitch && otherAgents.length > 0 ? (
        <>
          <MenuSeparator />
          {otherAgents.map((a) => (
            <MenuPeer
              key={a.id}
              label={a.name}
              icon={Cpu}
              onClick={() => {
                setOpen(false);
                onSwitch(a);
              }}
            />
          ))}
        </>
      ) : null}
    </EditablePill>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SessionSwitcher — actions menu for the current session.
// ────────────────────────────────────────────────────────────────────────────

function SessionSwitcher({
  activeSession,
  peers,
  onSelect,
  onNewSession,
  onRename,
  onDelete,
}: {
  activeSession: { id: string; title: string };
  peers: ClawThread[];
  onSelect?: (threadId: string) => void;
  onNewSession: () => void;
  onRename?: (newName: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const otherSessions = peers.filter((s) => s.id !== activeSession.id);

  return (
    <EditablePill
      label={activeSession.title}
      textClass="font-body text-md font-regular text-text-neutral-secondary"
      innerClass="max-w-[260px] truncate"
      open={open}
      onToggleOpen={() => setOpen((o) => !o)}
      onCloseOpen={() => setOpen(false)}
      editing={editing}
      onCommit={(next) => {
        void onRename?.(next);
        setEditing(false);
      }}
      onCancelEdit={() => setEditing(false)}
    >
      {onRename ? (
        <MenuAction
          icon={Pencil}
          label="Rename session"
          onClick={() => {
            setOpen(false);
            setEditing(true);
          }}
        />
      ) : null}
      <MenuAction
        icon={Plus}
        label="New session"
        onClick={() => {
          setOpen(false);
          onNewSession();
        }}
      />
      {onDelete ? (
        <MenuAction
          icon={Trash2}
          label="Delete session"
          destructive
          onClick={() => {
            setOpen(false);
            void onDelete();
          }}
        />
      ) : null}
      {onSelect && otherSessions.length > 0 ? (
        <>
          <MenuSeparator />
          {otherSessions.map((s) => (
            <MenuPeer
              key={s.id}
              label={s.title}
              onClick={() => {
                setOpen(false);
                onSelect(s.id);
              }}
            />
          ))}
        </>
      ) : null}
    </EditablePill>
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
  onRenameAgent,
  onDeleteAgent,
  onRenameSession,
  onDeleteSession,
  onOpenWorkspace,
}: AgentTopBarProps) {
  return (
    <TopBar
      leading={
        onBack ? (
          <IconButton
            icon={ArrowLeft}
            variant="secondary"
            size="md"
            title="Back"
            onClick={onBack}
          />
        ) : undefined
      }
      actions={
        <>
          {onOpenWorkspace ? (
            <IconButton
              icon={PanelRightOpen}
              variant="secondary"
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
        <AgentSwitcher
          agent={agent}
          peers={allAgents ?? []}
          onSwitch={onSwitchAgent}
          onRename={onRenameAgent}
          onDelete={onDeleteAgent}
        />
        <span
          aria-hidden="true"
          className="h-4 w-px shrink-0 bg-border-default dark:bg-border-default/16"
        />
        <SessionSwitcher
          activeSession={activeSession}
          peers={sessions ?? []}
          onSelect={onSelectSession}
          onNewSession={onNewSession}
          onRename={onRenameSession}
          onDelete={onDeleteSession}
        />
      </div>
    </TopBar>
  );
}

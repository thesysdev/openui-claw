"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";

import { MobileSwitcherSheet } from "@/components/mobile/MobileSwitcherSheet";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export interface TitleSwitcherItem {
  id: string;
  label: string;
  /** Optional right-aligned secondary text (e.g. parent agent name). */
  trailingText?: string;
  /** Optional leading node — e.g. a TextTile. */
  leading?: React.ReactNode;
}

export interface TitleSwitcherProps {
  /** Currently-selected item id. */
  activeId: string;
  /** Displayed label in the trigger (usually the active item's label). */
  currentLabel: string;
  /** All available items (includes the active one). */
  items: TitleSwitcherItem[];
  /** Called when a different item is picked. */
  onSelect: (id: string) => void;
  /** When set, surfaces a "Rename" action that swaps the trigger for an
   *  inline input. The handler fires when the user commits a non-empty,
   *  changed value (Enter or blur). */
  onRename?: (newLabel: string) => void | Promise<void>;
  /** When set, surfaces a destructive "Delete" action. */
  onDelete?: () => void | Promise<void>;
  /** Override the labels in the action menu. */
  renameLabel?: string;
  deleteLabel?: string;
}

interface ActionRowProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function ActionRow({ icon: Icon, label, onClick, destructive }: ActionRowProps) {
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
        className={
          destructive ? "text-text-danger-primary" : "text-text-neutral-tertiary"
        }
      />
      <span className="font-body text-sm">{label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-3xs h-px w-full bg-border-default/40" />;
}

/**
 * Clickable title that opens a dropdown of peer items (e.g. other apps or
 * other artifacts available in the current session).
 *
 * When `onRename` / `onDelete` are supplied, the dropdown also surfaces
 * those actions above a separator before the peer list. Clicking Rename
 * swaps the trigger for an inline input; commit on Enter / blur, cancel
 * on Escape.
 */
export function TitleSwitcher({
  activeId,
  currentLabel,
  items,
  onSelect,
  onRename,
  onDelete,
  renameLabel = "Rename",
  deleteLabel = "Delete",
}: TitleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentLabel);
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  // Sync draft + focus when entering edit mode.
  useLayoutEffect(() => {
    if (editing) {
      setDraft(currentLabel);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, currentLabel]);

  const commit = () => {
    const next = draft.trim();
    if (next.length === 0 || next === currentLabel) {
      setEditing(false);
      return;
    }
    void onRename?.(next);
    setEditing(false);
  };

  const peers = items.filter((it) => it.id !== activeId);
  const hasActions = !!onRename || !!onDelete;

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
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="flex h-7 items-center rounded-m border border-border-interactive-emphasis bg-background px-2xs font-label text-md font-medium text-text-neutral-primary outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex h-7 items-center gap-xs rounded-m px-2xs transition-colors ${
            open
              ? "bg-sunk-light dark:bg-highlight-subtle"
              : "bg-transparent hover:bg-sunk-light dark:hover:bg-highlight-subtle"
          }`}
        >
          <span className="font-label text-md font-medium text-text-neutral-primary">
            {currentLabel}
          </span>
        </button>
      )}
      {isMobile ? (
        <MobileSwitcherSheet
          open={open}
          onClose={() => setOpen(false)}
          title="Switch"
          activeId={activeId}
          options={items.map((it) => ({
            id: it.id,
            label: it.label,
            description: it.trailingText,
          }))}
          onSelect={(id) => onSelect(id)}
        />
      ) : open && !editing ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-80 w-[320px] overflow-y-auto rounded-lg border border-border-default bg-popover-background p-3xs shadow-xl dark:bg-elevated">
          {hasActions ? (
            <>
              {onRename ? (
                <ActionRow
                  icon={Pencil}
                  label={renameLabel}
                  onClick={() => {
                    setOpen(false);
                    setEditing(true);
                  }}
                />
              ) : null}
              {onDelete ? (
                <ActionRow
                  icon={Trash2}
                  label={deleteLabel}
                  destructive
                  onClick={() => {
                    setOpen(false);
                    void onDelete();
                  }}
                />
              ) : null}
              {peers.length > 0 ? <MenuSeparator /> : null}
            </>
          ) : null}
          {peers.map((it) => (
            <PeerRow
              key={it.id}
              item={it}
              onClick={() => {
                onSelect(it.id);
                setOpen(false);
              }}
            />
          ))}
          {/* When the dropdown only has actions and no peers, avoid an
              empty separator at the bottom. The actions render above
              already; nothing else is needed here. */}
          {!hasActions && peers.length === 0 ? (
            <p className="px-s py-xs font-body text-sm text-text-neutral-tertiary">
              No other items
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PeerRow({
  item,
  onClick,
}: {
  item: TitleSwitcherItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-s rounded-m px-s py-xs text-left transition-colors hover:bg-sunk-light dark:hover:bg-highlight-subtle"
    >
      {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
      <span className="min-w-0 flex-1 truncate font-body text-sm text-text-neutral-secondary">
        {item.label}
      </span>
      {item.trailingText ? (
        <span className="shrink-0 truncate font-body text-sm text-text-neutral-tertiary">
          {item.trailingText}
        </span>
      ) : null}
    </button>
  );
}

"use client";

import { RotateCw, Share2, Sparkles, Trash2, X } from "lucide-react";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { Button } from "@/components/ui/Button";
import { TitleSwitcher } from "@/components/chat/TitleSwitcher";

export interface DetailTopBarProps {
  /** Title shown on the left — app or artifact name. */
  title: string;
  /** Close handler — routes back to the previous view (e.g. home). */
  onClose: () => void;
  /** Opens the parent agent chat in a sidepane on the left. */
  onCustomize?: () => void;
  /** Share action (copy link, export, etc.). */
  onShare?: () => void;
  /** Delete the app/artifact. When supplied alongside `onRename`, the
   *  delete + rename actions are folded into the title's dropdown menu
   *  instead of being a separate trash button. */
  onDelete?: () => void;
  /** Inline-rename the app/artifact via the title's dropdown. When set,
   *  the title becomes a clickable pill that opens an actions menu;
   *  Rename swaps the pill for an inline input. */
  onRename?: (next: string) => void | Promise<void>;
  /** Custom labels for the title menu (e.g. "Rename app"). */
  renameLabel?: string;
  deleteLabel?: string;
  /** Refresh the content (reload from server). */
  onRefresh?: () => void;
}

/**
 * Shared top bar for fullscreen app & artifact detail views. Mirrors the
 * structure of the agent top bar: title on the left, action cluster on the
 * right with (l→r): refresh · delete · share · Customize · Close.
 */
export function DetailTopBar({
  title,
  onClose,
  onCustomize,
  onShare,
  onDelete,
  onRename,
  renameLabel,
  deleteLabel,
  onRefresh,
}: DetailTopBarProps) {
  // When the consumer wires up rename, fold delete into the title menu so
  // there's a single point of control for naming/destruction. Otherwise
  // keep the legacy standalone trash button.
  const useTitleMenu = !!onRename;
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-xs border-b border-border-default/50 px-m py-xs dark:border-border-default/16">
      {useTitleMenu ? (
        <TitleSwitcher
          activeId={title}
          currentLabel={title}
          items={[]}
          onSelect={() => {}}
          onRename={onRename}
          onDelete={onDelete}
          renameLabel={renameLabel}
          deleteLabel={deleteLabel}
        />
      ) : (
        <span className="truncate font-body text-md font-medium text-text-neutral-primary">
          {title}
        </span>
      )}
      <div className="flex items-center gap-xs">
        {onRefresh ? (
          <IconButton
            icon={RotateCw}
            variant="tertiary"
            size="md"
            title="Refresh"
            onClick={onRefresh}
          />
        ) : null}
        {/* Trash kept only when the title menu isn't in play (legacy flow). */}
        {onDelete && !useTitleMenu ? (
          <IconButton
            icon={Trash2}
            variant="tertiary"
            size="md"
            title="Delete"
            onClick={onDelete}
          />
        ) : null}
        {onShare ? (
          <IconButton
            icon={Share2}
            variant="tertiary"
            size="md"
            title="Share"
            onClick={onShare}
          />
        ) : null}
        {onCustomize ? (
          <Button
            variant="secondary"
            size="sm"
            icon={Sparkles}
            onClick={onCustomize}
            className="!font-normal"
          >
            Customize
          </Button>
        ) : null}
        <IconButton
          icon={X}
          variant="secondary"
          size="md"
          title="Close"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

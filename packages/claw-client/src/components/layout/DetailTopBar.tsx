"use client";

import { RotateCw, Share2, Sparkles, Trash2, X } from "lucide-react";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { Button } from "@/components/ui/Button";

export interface DetailTopBarProps {
  /** Title shown on the left — app or artifact name. */
  title: string;
  /** Close handler — routes back to the previous view (e.g. home). */
  onClose: () => void;
  /** Opens the parent agent chat in a sidepane on the left. */
  onCustomize?: () => void;
  /** Share action (copy link, export, etc.). */
  onShare?: () => void;
  /** Delete the app/artifact. */
  onDelete?: () => void;
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
  onRefresh,
}: DetailTopBarProps) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-xs border-b border-border-default/50 px-m py-xs dark:border-border-default/16">
      <span className="truncate font-body text-md font-medium text-text-neutral-primary">
        {title}
      </span>
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
        {onDelete ? (
          <IconButton
            icon={Trash2}
            variant="tertiary"
            size="md"
            title="Delete"
            onClick={onDelete}
          />
        ) : null}
        {onShare ? (
          <IconButton icon={Share2} variant="tertiary" size="md" title="Share" onClick={onShare} />
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
        <IconButton icon={X} variant="secondary" size="md" title="Close" onClick={onClose} />
      </div>
    </div>
  );
}

"use client";

import { TopBar } from "@/components/chat/TopBar";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { TextTile } from "@/components/layout/sidebar/Tile";
import { Menu, X } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

export interface RefineTrayProps {
  /** The thread id to embed in the iframe. When null, the tray collapses to 0 width. */
  threadId: string | null;
  /** Human-readable name of the agent whose thread is loaded. */
  agentName: string;
  /** Live width from `useRefineTrayDrag`. Ignored when `threadId` is null. */
  width: number;
  /** Drag handler from `useRefineTrayDrag`. */
  onDragStart: (e: ReactMouseEvent) => void;
  onClose: () => void;
}

/**
 * Left-side refine tray rendered alongside the app/artifact preview modal.
 * Shows the parent agent's chat inside an embedded iframe (`?embed=1`) so
 * the user can refine while looking at the live artifact.
 */
export function RefineTray({
  threadId,
  agentName,
  width,
  onDragStart,
  onClose,
}: RefineTrayProps) {
  const toggleWorkspace = () => {
    const ifr = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Refine agent"]',
    );
    ifr?.contentWindow?.postMessage({ type: "claw:toggle-workspace" }, "*");
  };

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden border-r border-border-default/50 bg-foreground transition-[width] duration-300 ease-out dark:border-border-default/16 dark:bg-sunk-deep"
      style={{ width: threadId ? width : 0 }}
    >
      {threadId ? (
        <div className="flex h-full w-full flex-col">
          <TopBar
            actions={
              <>
                <IconButton
                  icon={Menu}
                  variant="tertiary"
                  size="md"
                  title="Open thread workspace"
                  aria-label="Open thread workspace"
                  onClick={toggleWorkspace}
                />
                <IconButton
                  icon={X}
                  variant="tertiary"
                  size="md"
                  title="Close"
                  aria-label="Close tray"
                  onClick={onClose}
                />
              </>
            }
          >
            <TextTile label={agentName} category="agents" />
            <span className="font-label text-md font-medium text-text-neutral-primary">
              {agentName}
            </span>
          </TopBar>
          <iframe
            title="Refine agent"
            src={`${typeof window !== "undefined" ? window.location.pathname : "/"}?embed=1#/chat/${threadId}`}
            className="h-full w-full flex-1 border-0"
          />
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={onDragStart}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-border-default/70"
          />
        </div>
      ) : null}
    </div>
  );
}

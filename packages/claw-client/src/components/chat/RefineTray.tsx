"use client";

import { TopBar } from "@/components/chat/TopBar";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { TextTile } from "@/components/layout/sidebar/Tile";
import { ArrowLeft, Menu, X } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

export interface RefineTrayProps {
  /** The thread id to embed in the iframe. `null` hides the tray. */
  threadId: string | null;
  /** Human-readable name of the agent whose thread is loaded. */
  agentName: string;
  /** Live width from `useRefineTrayDrag`. */
  width: number;
  /** Drag handler from `useRefineTrayDrag`. */
  onDragStart: (e: ReactMouseEvent) => void;
  onClose: () => void;
  /** Mobile full-screen takeover — ignores `width`, hides drag handle, swaps close icon for back arrow. */
  fullScreen?: boolean;
}

/**
 * Left-side refine tray rendered alongside the app/artifact preview modal.
 * Renders the parent agent's chat inside an embedded iframe (`?embed=1`).
 * Hidden when `threadId` is null.
 */
export function RefineTray({
  threadId,
  agentName,
  width,
  onDragStart,
  onClose,
  fullScreen = false,
}: RefineTrayProps) {
  if (!threadId) return null;

  const toggleWorkspace = () => {
    const ifr = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Refine agent"]',
    );
    ifr?.contentWindow?.postMessage({ type: "claw:toggle-workspace" }, "*");
  };

  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-foreground dark:bg-sunk-deep ${
        fullScreen
          ? "absolute inset-0 z-[70] w-full"
          : "relative shrink-0 border-r border-border-default/50 transition-[width] duration-300 ease-out dark:border-border-default/16"
      }`}
      style={fullScreen ? undefined : { width }}
    >
      <TopBar
        leading={
          fullScreen ? (
            <IconButton
              icon={ArrowLeft}
              variant="tertiary"
              size="md"
              title="Back"
              aria-label="Back"
              onClick={onClose}
            />
          ) : undefined
        }
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
            {fullScreen ? null : (
              <IconButton
                icon={X}
                variant="tertiary"
                size="md"
                title="Close"
                aria-label="Close tray"
                onClick={onClose}
              />
            )}
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
      {fullScreen ? null : (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onDragStart}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-border-default/70"
        />
      )}
    </div>
  );
}

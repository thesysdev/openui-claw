"use client";

import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useActiveArtifact, useThread } from "@openuidev/react-headless";
import { ArtifactPortalTarget, Shell } from "@openuidev/react-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_CHAT_WIDTH_PX = 420;
const MIN_CHAT_WIDTH_PX = 420;
const MAX_CHAT_WIDTH_RATIO = 0.8;

/**
 * Claw's thread container. Mirrors `Shell.ThreadContainer`'s split-pane and
 * slide-in animation but owns the artifact portal target itself.
 *
 *   - Desktop, no artifact:  chat panel = 100%, no right pane.
 *   - Desktop, artifact on:  chat snaps to 420px, animated artifact side-pane
 *                            slides in from the right; a draggable separator
 *                            between them resizes the split (mirrors shell's
 *                            useArtifactResize). Main nav auto-collapses via
 *                            the shell store.
 *   - Mobile, artifact on:   absolute fullscreen overlay covers the chat —
 *                            shell's `<ArtifactOverlay>` is bypassed because
 *                            it anchors to chat-panel bounds, which collapse
 *                            weirdly when the panel competes with mobile
 *                            chrome.
 */
export const ClawThreadContainer = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const isMobile = useIsMobile();
  const { isArtifactActive } = useActiveArtifact();
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
  const setIsSidebarOpen = Shell.useShellStore((s) => s.setIsSidebarOpen);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sidebar collapse + chat-panel sizing on artifact (de)activation. Setting
  // width imperatively (vs. via React state) avoids a render churn during
  // resize drags.
  useEffect(() => {
    if (isMobile) return;
    if (isArtifactActive) {
      setIsSidebarOpen(false);
      if (chatPanelRef.current) {
        chatPanelRef.current.style.width = `${INITIAL_CHAT_WIDTH_PX}px`;
      }
    } else if (chatPanelRef.current) {
      chatPanelRef.current.style.width = "100%";
    }
  }, [isArtifactActive, isMobile, setIsSidebarOpen]);

  // Drag-to-resize. Refs hold the latest container/chat refs so we can keep
  // the document-level listeners stable for the lifetime of the dragging
  // session and avoid re-binding per-render.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current || !chatPanelRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const proposed = e.clientX - rect.left;
      const max = rect.width * MAX_CHAT_WIDTH_RATIO;
      const next = Math.min(Math.max(proposed, MIN_CHAT_WIDTH_PX), max);
      chatPanelRef.current.style.width = `${next}px`;
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const initialWidth = !isMobile && isArtifactActive ? `${INITIAL_CHAT_WIDTH_PX}px` : "100%";
  // Drop the transition while dragging so the panel tracks the cursor 1:1
  // instead of easing toward each cursor position.
  const chatPanelClass = isDragging
    ? "openui-shell-thread-chat-panel"
    : "openui-shell-thread-chat-panel openui-shell-thread-chat-panel--animating";

  return (
    <div
      className={[
        "openui-shell-thread-container",
        "relative",
        isArtifactActive ? "openui-shell-thread-container--artifact-active" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ visibility: isLoadingMessages ? "hidden" : undefined }}
    >
      <div className="openui-shell-thread-wrapper" ref={wrapperRef}>
        <div ref={chatPanelRef} className={chatPanelClass} style={{ width: initialWidth }}>
          {children}
        </div>
        {!isMobile && isArtifactActive && (
          <>
            <div
              className="openui-shell-resizable-separator"
              onMouseDown={handleMouseDown}
              role="separator"
              aria-orientation="vertical"
            >
              <div className="openui-shell-resizable-separator__handle" />
            </div>
            <div
              className={
                isDragging
                  ? "openui-shell-thread-artifact-panel"
                  : "openui-shell-thread-artifact-panel openui-shell-thread-artifact-panel--animating"
              }
            >
              <ArtifactPortalTarget className="h-full w-full" />
            </div>
          </>
        )}
      </div>
      {isMobile && isArtifactActive && (
        <div className="absolute inset-0 z-30 flex bg-background dark:bg-sunk">
          <div className="flex min-w-0 flex-1 flex-col">
            <ArtifactPortalTarget className="h-full w-full" />
          </div>
        </div>
      )}
    </div>
  );
};

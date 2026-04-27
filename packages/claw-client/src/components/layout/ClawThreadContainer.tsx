"use client";

import { useActiveArtifact, useThread } from "@openuidev/react-headless";
import type { ReactNode } from "react";

// Drop-in replacement for `Shell.ThreadContainer` minus the chat+side-panel
// split. Preserves the theming class hooks (`openui-shell-thread-*`) so
// react-ui's stylesheet keeps working, and the loading-visibility hide that
// suppresses the message-load flash. We render our own fullscreen
// `<ArtifactPortalTarget>` in ChatApp, so we deliberately omit the
// auto-mounted artifact panel + ResizableSeparator that Shell.ThreadContainer
// hard-codes on desktop.
export function ClawThreadContainer({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
  const { isArtifactActive } = useActiveArtifact();

  return (
    <div
      className={[
        "openui-shell-thread-container",
        className,
        isArtifactActive ? "openui-shell-thread-container--artifact-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ visibility: isLoadingMessages ? "hidden" : undefined }}
    >
      <div className="openui-shell-thread-wrapper">
        <div className="openui-shell-thread-chat-panel">{children}</div>
      </div>
    </div>
  );
}

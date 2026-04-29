"use client";

import { MobileDetailHeader } from "@/components/mobile/MobileDetailHeader";
import {
  WorkspaceSections,
  type WorkspacePaneProps,
} from "@/components/session/SessionWorkspacePane";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

interface Props extends WorkspacePaneProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen mobile twin of `SessionWorkspaceDrawer` — same content
 * (`WorkspaceSections`), but rendered as a top-level sheet with the standard
 * mobile detail header (back arrow + title) instead of a 260px side drawer.
 */
export function MobileWorkspaceDrawer({ open, onClose, ...props }: Props) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="claw-fade-in fixed inset-0 z-[80] flex flex-col bg-background">
      <MobileDetailHeader
        onBack={onClose}
        backLabel="Close workspace"
        title={{ label: "Workspace" }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-s py-m">
        <WorkspaceSections {...props} />
      </div>
    </div>
  );
}

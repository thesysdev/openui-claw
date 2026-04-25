"use client";

import { ArtifactContentView } from "@/components/artifacts/ArtifactContentView";
import { DetailTopBar } from "@/components/layout/DetailTopBar";
import { TopBar } from "@/components/chat/TopBar";
import {
  TitleSwitcher,
  type TitleSwitcherItem,
} from "@/components/chat/TitleSwitcher";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/layout/sidebar/IconButton";
import { TextTile } from "@/components/layout/sidebar/Tile";
import type { ArtifactRecord, ArtifactStore } from "@/lib/engines/types";
import { artifactsHash } from "@/lib/hooks/useHashRoute";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { ArrowLeft, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  artifactId: string;
  artifacts: ArtifactStore;
  updatedAt?: string;
  mode?: "page" | "panel";
  onDeleted?: () => void;
  onClose?: () => void;
  onCustomize?: (record: ArtifactRecord) => void;
  onShare?: (record: ArtifactRecord) => void;
  onRefine?: (record: ArtifactRecord) => void | Promise<void>;
  /** Peers shown in the title switcher dropdown. */
  siblings?: TitleSwitcherItem[];
  /** Called when the user picks a different peer from the title dropdown. */
  onSwitch?: (artifactId: string) => void;
}

export function ArtifactDetail({
  artifactId,
  artifacts,
  updatedAt,
  mode = "page",
  onDeleted,
  onClose,
  onCustomize,
  onShare,
  onRefine,
  siblings,
  onSwitch,
}: Props) {
  const isMobile = useIsMobile();
  const [record, setRecord] = useState<ArtifactRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setRecord(null);
    artifacts
      .getArtifact(artifactId)
      .then((r) => {
        if (!r) setNotFound(true);
        else setRecord(r);
      })
      .finally(() => setLoading(false));
  }, [artifactId, artifacts, updatedAt]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-neutral-tertiary">Loading…</p>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-text-neutral-secondary">Artifact not found</p>
        <a
          href={artifactsHash()}
          className="text-sm text-text-neutral-tertiary underline underline-offset-2 hover:text-text-neutral-secondary"
        >
          ← Back to artifacts
        </a>
      </div>
    );
  }

  const contentDisplay =
    typeof record.content === "string" ? record.content : JSON.stringify(record.content, null, 2);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await artifacts.deleteArtifact(artifactId);
      if (mode === "page") {
        window.location.hash = artifactsHash();
      }
      onDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {mode === "page" && (
        <DetailTopBar
          title={record.title}
          onClose={onClose ?? (() => { window.location.hash = artifactsHash(); })}
          onCustomize={onCustomize ? () => onCustomize(record) : undefined}
          onShare={onShare ? () => onShare(record) : undefined}
          onDelete={() => void handleDelete()}
          onRefresh={() => window.location.reload()}
        />
      )}

      {mode === "panel" ? (
        <TopBar
          leading={
            isMobile && onClose ? (
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
              {onRefine ? (
                <Button
                  variant="tertiary"
                  size="md"
                  icon={Sparkles}
                  onClick={() => void onRefine(record)}
                >
                  Refine
                </Button>
              ) : null}
              <IconButton
                icon={Trash2}
                variant="tertiary"
                size="md"
                title="Delete artifact"
                onClick={() => void handleDelete()}
              />
              {onClose && !isMobile ? (
                <IconButton
                  icon={X}
                  variant="tertiary"
                  size="md"
                  title="Close"
                  aria-label="Close"
                  onClick={onClose}
                />
              ) : null}
            </>
          }
        >
          <TextTile label={record.title} category="artifacts" />
          {siblings && siblings.length >= 1 && onSwitch ? (
            <TitleSwitcher
              activeId={artifactId}
              currentLabel={record.title}
              items={siblings}
              onSelect={onSwitch}
            />
          ) : (
            <span className="font-label text-md font-medium text-text-neutral-primary">
              {record.title}
            </span>
          )}
        </TopBar>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <ArtifactContentView
          title={record.title}
          kind={record.kind}
          content={contentDisplay}
          metadata={record.metadata}
        />
      </div>
    </div>
  );
}

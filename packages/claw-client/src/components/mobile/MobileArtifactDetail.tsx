"use client";

import { MoreVertical, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ArtifactContentView } from "@/components/artifacts/ArtifactContentView";
import type { TitleSwitcherItem } from "@/components/chat/TitleSwitcher";
import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { MobileButton } from "@/components/mobile/MobileButton";
import { MobileDetailHeader } from "@/components/mobile/MobileDetailHeader";
import { MobileMenuDrawer } from "@/components/mobile/MobileMenuDrawer";
import { MobileSwitcherSheet } from "@/components/mobile/MobileSwitcherSheet";
import type { ArtifactRecord, ArtifactStore } from "@/lib/engines/types";

interface Props {
  artifactId: string;
  artifacts: ArtifactStore;
  updatedAt?: string;
  onDeleted?: () => void;
  onRefine?: (record: ArtifactRecord) => void | Promise<void>;
  onClose: () => void;
  siblings?: TitleSwitcherItem[];
  onSwitch?: (artifactId: string) => void;
}

export function MobileArtifactDetail({
  artifactId,
  artifacts,
  updatedAt,
  onDeleted,
  onRefine,
  onClose,
  siblings,
  onSwitch,
}: Props) {
  const [record, setRecord] = useState<ArtifactRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const hasSiblings = (siblings?.length ?? 0) > 1 && Boolean(onSwitch);

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

  const handleDelete = async () => {
    try {
      await artifacts.deleteArtifact(artifactId);
      onDeleted?.();
      onClose();
    } catch {
      /* swallow */
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-background">
        <p className="text-sm text-text-neutral-tertiary">Loading…</p>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="flex h-full flex-1 flex-col bg-background">
        <MobileDetailHeader onBack={onClose} title={{ label: "Not found" }} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-neutral-secondary">Artifact not found</p>
        </div>
      </div>
    );
  }

  const contentDisplay =
    typeof record.content === "string" ? record.content : JSON.stringify(record.content, null, 2);

  return (
    <div className="claw-fade-in flex h-full flex-1 flex-col bg-background">
      <MobileDetailHeader
        onBack={onClose}
        title={{
          label: record.title,
          onTap: hasSiblings ? () => setSwitchOpen(true) : undefined,
        }}
        actions={
          <>
            {onRefine ? (
              <MobileButton variant="secondary" onClick={() => void onRefine(record)}>
                <Sparkles size={14} />
                Refine
              </MobileButton>
            ) : null}
            <HeaderIconButton onClick={() => setMenuOpen(true)} label="Open menu">
              <MoreVertical size={18} />
            </HeaderIconButton>
          </>
        }
      />

      {hasSiblings && onSwitch ? (
        <MobileSwitcherSheet
          open={switchOpen}
          onClose={() => setSwitchOpen(false)}
          title="Switch artifact"
          activeId={artifactId}
          options={(siblings ?? []).map((s) => ({
            id: s.id,
            label: s.label,
            description: s.trailingText,
          }))}
          onSelect={(id) => onSwitch(id)}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <ArtifactContentView
          title={record.title}
          kind={record.kind}
          content={contentDisplay}
          metadata={record.metadata}
        />
      </div>

      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={record.title}
        items={[
          {
            key: "delete",
            label: "Delete artifact",
            icon: Trash2,
            destructive: true,
            onSelect: () => void handleDelete(),
          },
        ]}
      />
    </div>
  );
}

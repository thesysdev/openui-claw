"use client";

import { FileText, Image as ImageIcon, ScrollText, Table2 } from "lucide-react";
import type { ComponentType } from "react";

import { AppCard } from "@/components/cards/AppCard";
import type { ArtifactSummary } from "@/lib/engines/types";

const ICON_BY_KIND: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  doc: FileText,
  csv: Table2,
  image: ImageIcon,
};

const CHIP_BY_KIND: Record<string, { label: string; className: string }> = {
  doc: { label: "Doc", className: "text-text-info-primary bg-text-info-primary/10" },
  csv: { label: "CSV", className: "text-text-success-primary bg-text-success-primary/10" },
  image: { label: "Image", className: "text-cat-artifact bg-cat-artifact/10" },
};

export interface ArtifactCardProps {
  artifact: ArtifactSummary;
  onClick?: () => void;
}

/**
 * Variant of AppCard used in the All artifacts list. Picks an icon + chip
 * from the artifact's `kind` and tints the avatar tile with the artifact
 * category color.
 */
export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const Icon = ICON_BY_KIND[artifact.kind] ?? ScrollText;
  const chipSpec =
    CHIP_BY_KIND[artifact.kind] ?? {
      label: artifact.kind || "File",
      className: "text-text-neutral-tertiary bg-foreground",
    };
  const chip = (
    <span
      className={`inline-block shrink-0 rounded-s px-xs py-[1px] font-label text-sm font-medium ${chipSpec.className}`}
    >
      {chipSpec.label}
    </span>
  );
  return (
    <AppCard
      app={{
        id: artifact.id,
        name: artifact.title,
        icon: Icon,
        agent: artifact.source.agentId,
        lastUsed: artifact.updatedAt,
      }}
      chip={chip}
      category="artifact"
      onClick={onClick}
    />
  );
}

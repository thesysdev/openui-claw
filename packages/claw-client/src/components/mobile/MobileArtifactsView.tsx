"use client";

import { FileText, Image as ImageIcon, ScrollText, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/home/SectionHeader";
import { MobileListCard, MobileListRow } from "@/components/mobile/MobileListRow";
import { SortButton } from "@/components/ui/SortButton";
import type { ArtifactStore, ArtifactSummary } from "@/lib/engines/types";

type Sort = "recent" | "a-z";

const ARTIFACT_ICON: Record<string, typeof FileText> = {
  doc: FileText,
  csv: Table2,
  image: ImageIcon,
};

interface Props {
  artifacts: ArtifactStore;
  onOpenArtifact: (artifactId: string) => void;
}

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function MobileArtifactsView({ artifacts, onOpenArtifact }: Props) {
  const [items, setItems] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    setLoading(true);
    artifacts
      .listArtifacts()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [artifacts]);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "a-z") arr.sort((a, b) => a.title.localeCompare(b.title));
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [items, sort]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-neutral-tertiary">Loading artifacts…</p>
      </div>
    );
  }

  return (
    <div className="h-full flex-1 overflow-y-auto bg-background p-ml">
      <div className="mx-auto max-w-[1080px]">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
            Artifacts created during conversations will appear here.
          </p>
        ) : (
          <section className="mb-3xl">
            <SectionHeader
              title="All artifacts"
              right={<SortButton value={sort} onChange={setSort} />}
            />
            <MobileListCard>
              {sorted.map((a) => {
                const Icon = ARTIFACT_ICON[a.kind] ?? ScrollText;
                return (
                  <MobileListRow
                    key={a.id}
                    icon={Icon}
                    title={a.title}
                    subtitle={`by ${truncate(a.source.agentId)}`}
                    category="artifact"
                    onClick={() => onOpenArtifact(a.id)}
                  />
                );
              })}
            </MobileListCard>
          </section>
        )}
      </div>
    </div>
  );
}

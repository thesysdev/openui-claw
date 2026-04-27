"use client";

import { useEffect, useMemo, useState } from "react";

import { ArtifactCard } from "@/components/cards/ArtifactCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SortPills } from "@/components/ui/SortPills";
import type { ArtifactStore, ArtifactSummary } from "@/lib/engines/types";
import { ConnectionState } from "@/lib/gateway/types";

type Sort = "recent" | "a-z";

interface Props {
  artifacts: ArtifactStore;
  onOpenArtifact: (artifactId: string) => void;
  connectionState: ConnectionState;
}

export function ArtifactsView({ artifacts, onOpenArtifact, connectionState }: Props) {
  const [items, setItems] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(connectionState === ConnectionState.CONNECTED);
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    if (connectionState !== ConnectionState.CONNECTED) {
      setLoading(false);
      return;
    }
    setLoading(true);
    artifacts
      .listArtifacts()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [artifacts, connectionState]);

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
    <div className="h-full flex-1 overflow-y-auto bg-background p-3xl">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="mb-3xl font-heading text-lg font-bold text-text-neutral-primary">
          Artifacts
        </h2>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
            Artifacts created during conversations will appear here.
          </p>
        ) : (
          <section className="mb-3xl">
            <SectionHeader
              title="All artifacts"
              right={
                <SortPills
                  value={sort}
                  options={[{ key: "recent", label: "Recent" }, { key: "a-z", label: "A–Z" }]}
                  onChange={setSort}
                />
              }
            />
            <div className="grid grid-cols-1 gap-ml sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((a) => (
                <ArtifactCard
                  key={a.id}
                  artifact={a}
                  onClick={() => onOpenArtifact(a.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

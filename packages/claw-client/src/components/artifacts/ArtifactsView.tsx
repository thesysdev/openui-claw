"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import type { ArtifactStore, ArtifactSummary } from "@/lib/engines/types";
import { artifactHash } from "@/lib/hooks/useHashRoute";

interface Props {
  artifacts: ArtifactStore;
}

export function ArtifactsView({ artifacts }: Props) {
  const [items, setItems] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    artifacts
      .listArtifacts()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [artifacts]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-neutral-tertiary">Loading artifacts…</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-xl">
      <h1 className="mb-6 text-lg font-semibold text-text-neutral-primary">
        Artifacts
      </h1>

      {items.length === 0 ? (
        <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
            <Package className="h-6 w-6 text-text-neutral-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-neutral-secondary">
            No artifacts yet
          </p>
          <p className="max-w-xs text-sm text-text-neutral-tertiary">
            Artifacts created during conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <a
              key={item.id}
              href={artifactHash(item.id)}
              className="group flex flex-col gap-2 rounded-xl border border-border-default bg-background p-ml transition-colors hover:bg-sunk-light"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-text-neutral-primary">
                  {item.title}
                </span>
                <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-sm font-medium text-text-neutral-tertiary">
                  {item.kind}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-sm text-text-neutral-tertiary">
                <span className="truncate">{item.source.agentId}</span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

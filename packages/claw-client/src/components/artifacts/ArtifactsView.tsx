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
        <p className="text-sm text-zinc-400">Loading artifacts…</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Artifacts
      </h1>

      {items.length === 0 ? (
        <div className="flex h-[calc(100%-3rem)] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Package className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            No artifacts yet
          </p>
          <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
            Artifacts created during conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <a
              key={item.id}
              href={artifactHash(item.id)}
              className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {item.kind}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-[11px] text-zinc-400">
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

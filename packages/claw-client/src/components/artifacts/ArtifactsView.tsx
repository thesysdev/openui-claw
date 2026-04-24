"use client";

import { useEffect, useMemo, useState } from "react";

import { ArtifactCard } from "@/components/cards/ArtifactCard";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/home/SectionHeader";
import type { ArtifactStore, ArtifactSummary } from "@/lib/engines/types";

type Sort = "recent" | "a-z";

interface Props {
  artifacts: ArtifactStore;
  onOpenArtifact: (artifactId: string) => void;
}

export function ArtifactsView({ artifacts, onOpenArtifact }: Props) {
  const [items, setItems] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    artifacts
      .listArtifacts()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [artifacts]);

  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const a of items) if (a.kind) set.add(a.kind);
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const byFilter = filter === "all" ? items : items.filter((a) => a.kind === filter);
    const arr = [...byFilter];
    if (sort === "a-z") arr.sort((a, b) => a.title.localeCompare(b.title));
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [items, filter, sort]);

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
                <div className="flex items-center gap-s">
                  {kinds.length > 1 ? (
                    <PillGroup>
                      <PillButton active={filter === "all"} onClick={() => setFilter("all")}>
                        All
                      </PillButton>
                      {kinds.map((k) => (
                        <PillButton key={k} active={filter === k} onClick={() => setFilter(k)}>
                          {capitalize(k)}
                        </PillButton>
                      ))}
                    </PillGroup>
                  ) : null}
                  <PillGroup>
                    <PillButton active={sort === "recent"} onClick={() => setSort("recent")}>
                      Recent
                    </PillButton>
                    <PillButton active={sort === "a-z"} onClick={() => setSort("a-z")}>
                      A–Z
                    </PillButton>
                  </PillGroup>
                </div>
              }
            />
            <div className="grid grid-cols-1 gap-ml sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a) => (
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

function PillGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3xs rounded-l bg-sunk-light p-3xs">{children}</div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="pill" size="sm" active={active} onClick={onClick}>
      {children}
    </Button>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

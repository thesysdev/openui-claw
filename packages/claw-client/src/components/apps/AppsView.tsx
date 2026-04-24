"use client";

import { LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";

import { AppCard } from "@/components/cards/AppCard";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/home/SectionHeader";
import type { AppSummary } from "@/lib/engines/types";

type Sort = "recent" | "a-z";

export interface AppsViewProps {
  apps: AppSummary[];
  pinnedAppIds: Set<string>;
  onOpenApp: (appId: string) => void;
}

export function AppsView({ apps, pinnedAppIds, onOpenApp }: AppsViewProps) {
  const [sort, setSort] = useState<Sort>("recent");

  const { topApps, otherApps } = useMemo(() => {
    const top: AppSummary[] = [];
    const rest: AppSummary[] = [];
    for (const app of apps) {
      if (pinnedAppIds.has(app.id)) top.push(app);
      else rest.push(app);
    }
    return { topApps: top, otherApps: rest };
  }, [apps, pinnedAppIds]);

  const sortedOther = useMemo(() => {
    const arr = [...otherApps];
    if (sort === "a-z") arr.sort((a, b) => a.title.localeCompare(b.title));
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [otherApps, sort]);

  return (
    <div className="h-full flex-1 overflow-y-auto bg-background p-3xl">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="mb-3xl font-heading text-lg font-bold text-text-neutral-primary">Apps</h2>

        {apps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
            Agents will create apps here as you chat.
          </p>
        ) : (
          <>
            {topApps.length > 0 && (
              <section className="mb-3xl">
                <SectionHeader title="Top apps" />
                <div className="grid grid-cols-1 gap-ml sm:grid-cols-2 lg:grid-cols-3">
                  {topApps.map((app) => (
                    <AppCard
                      key={app.id}
                      app={{
                        id: app.id,
                        name: app.title,
                        icon: LayoutGrid,
                        agent: app.agentId,
                        lastUsed: app.updatedAt,
                      }}
                      category="app"
                      onClick={() => onOpenApp(app.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-3xl">
              <SectionHeader
                title="All apps"
                right={<SortPills sort={sort} onChange={setSort} />}
              />
              <div className="grid grid-cols-1 gap-ml sm:grid-cols-2 lg:grid-cols-3">
                {sortedOther.map((app) => (
                  <AppCard
                    key={app.id}
                    app={{
                      id: app.id,
                      name: app.title,
                      icon: LayoutGrid,
                      agent: app.agentId,
                      lastUsed: app.updatedAt,
                    }}
                    category="app"
                    onClick={() => onOpenApp(app.id)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SortPills({ sort, onChange }: { sort: Sort; onChange: (next: Sort) => void }) {
  return (
    <div className="flex items-center gap-3xs rounded-l bg-sunk-light p-3xs">
      {(
        [
          { key: "recent", label: "Recent" },
          { key: "a-z", label: "A–Z" },
        ] as const
      ).map((s) => (
        <Button
          key={s.key}
          variant="pill"
          size="sm"
          active={sort === s.key}
          onClick={() => onChange(s.key)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}

"use client";

import { LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionHeader } from "@/components/home/SectionHeader";
import { MobileListCard, MobileListRow } from "@/components/mobile/MobileListRow";
import { SortButton } from "@/components/ui/SortButton";
import type { AppSummary } from "@/lib/engines/types";

type Sort = "recent" | "a-z";

export interface AppsViewProps {
  apps: AppSummary[];
  pinnedAppIds: Set<string>;
  onOpenApp: (appId: string) => void;
}

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function MobileAppsView({ apps, pinnedAppIds, onOpenApp }: AppsViewProps) {
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
    <div className="h-full flex-1 overflow-y-auto bg-background p-ml">
      <div className="mx-auto max-w-[1080px]">
        {apps.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-default px-ml py-xl text-sm text-text-neutral-tertiary">
            Agents will create apps here as you chat.
          </p>
        ) : (
          <>
            {topApps.length > 0 && (
              <section className="mb-ml">
                <SectionHeader title="Top apps" />
                <MobileListCard>
                  {topApps.map((app) => (
                    <MobileListRow
                      key={app.id}
                      icon={LayoutGrid}
                      title={app.title}
                      subtitle={`by ${truncate(app.agentId)}`}
                      category="app"
                      onClick={() => onOpenApp(app.id)}
                    />
                  ))}
                </MobileListCard>
              </section>
            )}

            <section className="mb-3xl">
              <SectionHeader
                title="All apps"
                right={<SortButton value={sort} onChange={setSort} />}
              />
              <MobileListCard>
                {sortedOther.map((app) => (
                  <MobileListRow
                    key={app.id}
                    icon={LayoutGrid}
                    title={app.title}
                    subtitle={`by ${truncate(app.agentId)}`}
                    category="app"
                    onClick={() => onOpenApp(app.id)}
                  />
                ))}
              </MobileListCard>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { LayoutGrid, Sparkles, Trash2 } from "lucide-react";
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
  onDeleteApp?: (appId: string) => void | Promise<void>;
  onRefineApp?: (app: AppSummary) => void;
}

function truncate(value: string, max = 48): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function MobileAppsView({
  apps,
  pinnedAppIds,
  onOpenApp,
  onDeleteApp,
  onRefineApp,
}: AppsViewProps) {
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

  if (apps.length === 0) {
    return (
      <div
        className="flex h-full flex-1 items-center justify-center bg-background p-ml"
        style={{ minHeight: "calc(100dvh - 120px)" }}
      >
        <p className="text-center text-sm text-text-neutral-tertiary">
          Agents will create apps here as you chat.
        </p>
      </div>
    );
  }

  return (
    <div className="claw-fade-in h-full flex-1 overflow-y-auto bg-background p-ml">
      <div className="mx-auto max-w-[1080px]">
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
      </div>
    </div>
  );
}

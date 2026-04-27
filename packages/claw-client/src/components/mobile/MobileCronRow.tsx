"use client";

import { Clock3 } from "lucide-react";
import type { Thread } from "@openuidev/react-headless";

import { cronOwnerLabel, humanFrequency } from "@/components/crons/format";
import { Tag } from "@/components/layout/sidebar/Tag";
import type { CronJobRecord } from "@/lib/cron";

export interface MobileCronRowProps {
  job: CronJobRecord;
  threads: Thread[];
  onClick: () => void;
}

export function MobileCronRow({ job, threads, onClick }: MobileCronRowProps) {
  const owner = cronOwnerLabel(job, threads);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] w-full items-center gap-m bg-transparent px-ml py-m text-left transition-colors duration-150 first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light"
    >
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-m bg-cat-activity/10">
        <Clock3 size={14} className="text-cat-activity" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-text-neutral-primary">
          {job.name}
        </p>
        <p className="truncate font-body text-2xs text-text-neutral-tertiary/70">
          <Tag size="sm" variant={job.enabled ? "success" : "neutral"} className="align-middle">
            {job.enabled ? "Active" : "Paused"}
          </Tag>
          <span className="mx-xs inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-text-neutral-tertiary/50 align-middle" />
          <span>{humanFrequency(job)}</span>
          {owner ? (
            <>
              <span className="mx-xs inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-text-neutral-tertiary/50 align-middle" />
              <span>by {owner}</span>
            </>
          ) : null}
        </p>
      </div>
    </button>
  );
}

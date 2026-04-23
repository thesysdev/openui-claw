"use client";

import { ChevronRight } from "lucide-react";

import { relTime } from "@/lib/time";

import { type HomeNotif, TYPE_TAG } from "./types";

export interface NeedsInputCardProps {
  notif: HomeNotif;
  onAction?: () => void;
  onClick?: () => void;
}

/**
 * Elevated card shown at the top of the notification list for items that
 * need the user's attention — includes a call-to-action button.
 */
export function NeedsInputCard({ notif, onAction, onClick }: NeedsInputCardProps) {
  const tag = TYPE_TAG.needs_input;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-s w-full rounded-lg border border-border-default/50 bg-popover-background p-ml text-left shadow-xl transition-[border-color,box-shadow] duration-150 hover:border-border-default dark:border-transparent dark:bg-foreground dark:hover:border-transparent"
    >
      <div className="flex items-center gap-xs">
        <span
          className={`shrink-0 rounded-s px-xs py-[1px] font-label text-2xs font-medium leading-[1.4] ${tag.bg} ${tag.fg}`}
        >
          {tag.label}
        </span>
        <p className="flex-1 truncate font-body text-sm font-medium text-text-neutral-primary">
          {notif.title}
        </p>
        <ChevronRight
          size={14}
          className="shrink-0 -translate-x-2xs text-text-neutral-tertiary opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </div>
      <p className="mt-3xs font-body text-xs text-text-neutral-tertiary">{notif.desc}</p>
      <div className="mt-3xs flex items-center gap-xs">
        {notif.agent ? (
          <span className="font-body text-2xs text-text-neutral-tertiary/70">{notif.agent}</span>
        ) : null}
        {notif.agent ? <span className="text-2xs text-text-neutral-tertiary/40">·</span> : null}
        <span className="font-body text-2xs text-text-neutral-tertiary/70">
          {relTime(notif.time)}
        </span>
      </div>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onAction?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onAction?.();
          }
        }}
        className="mt-s inline-flex cursor-pointer items-center rounded-m border border-border-default bg-background px-m py-xs font-label text-sm font-medium text-text-neutral-primary shadow-sm transition-colors duration-150 hover:bg-sunk-light dark:border-transparent dark:bg-sunk-light dark:hover:bg-sunk"
      >
        {notif.cta ?? "Take action"}
      </span>
    </button>
  );
}

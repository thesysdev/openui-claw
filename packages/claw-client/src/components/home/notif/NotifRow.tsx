"use client";

import { ChevronRight } from "lucide-react";

import { Sep } from "@/components/ui/Sep";
import { StatusDot } from "@/components/ui/StatusDot";
import { relTime } from "@/lib/time";

import { type HomeNotif, TYPE_TAG } from "./types";

export interface NotifRowProps {
  notif: HomeNotif;
  isLast?: boolean;
  onClick?: () => void;
  onMarkRead?: () => void;
}

/** Single notification row — type tag + title + unread dot + description + metadata. */
export function NotifRow({ notif, isLast = false, onClick, onMarkRead }: NotifRowProps) {
  const tag = TYPE_TAG[notif.type];
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!notif.read) onMarkRead?.();
          onClick?.();
        }}
        className={`group flex w-full items-start gap-s rounded-lg px-ml py-ml text-left transition-[background-color,opacity] duration-150 hover:bg-sunk-light dark:hover:bg-sunk-light ${
          notif.read ? "opacity-55" : "opacity-100"
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3xs">
          <div className="flex items-center gap-xs">
            <span
              className={`shrink-0 rounded-s px-xs py-[1px] font-label text-2xs font-medium leading-[1.4] ${tag.bg} ${tag.fg}`}
            >
              {tag.label}
            </span>
            <p className="truncate flex-1 font-body text-sm font-medium text-text-neutral-primary">
              {notif.title}
            </p>
            {!notif.read ? <StatusDot className="bg-interactive-accent" size={6} /> : null}
          </div>
          <p className="truncate font-body text-xs text-text-neutral-tertiary">{notif.desc}</p>
          <div className="flex items-center gap-xs">
            {notif.agent ? (
              <span className="font-body text-2xs text-text-neutral-tertiary/70">
                {notif.agent}
              </span>
            ) : null}
            {notif.agent ? <span className="text-2xs text-text-neutral-tertiary/40">·</span> : null}
            <span className="font-body text-2xs text-text-neutral-tertiary/70">
              {relTime(notif.time)}
            </span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="mt-xs shrink-0 -translate-x-2xs text-text-neutral-tertiary opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </button>
      {!isLast ? (
        <div className="mx-s group-hover:hidden">
          <Sep />
        </div>
      ) : null}
    </>
  );
}

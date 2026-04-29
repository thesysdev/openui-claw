"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export interface MobileSwitcherOption {
  id: string;
  label: string;
  description?: string;
}

interface MobileSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  activeId?: string | null;
  options: MobileSwitcherOption[];
  onSelect: (id: string) => void;
  /** Optional footer slot — e.g. "+ New session". */
  footer?: ReactNode;
}

/**
 * Bottom-sheet picker used to switch between contextual entities (agent or
 * session). Top-rounded only, full-width to the screen edges, with a checkmark
 * on the active option.
 */
export function MobileSwitcherSheet({
  open,
  onClose,
  title,
  activeId,
  options,
  onSelect,
  footer,
}: MobileSwitcherSheetProps) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title}`}
        className="claw-fade-in flex-1 bg-overlay backdrop-blur-[2px]"
      />
      <div
        role="menu"
        className="claw-slide-up rounded-t-2xl border-t border-border-default/50 bg-background shadow-2xl dark:border-border-default/16 dark:bg-foreground"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-s mt-s h-[3px] w-10 rounded-full bg-border-default/60 dark:bg-border-default/30" />
        <h3 className="px-ml pb-s text-sm font-medium text-text-neutral-secondary">{title}</h3>
        <ul className="px-2xs">
          {options.map((opt) => {
            const active = opt.id === activeId;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onSelect(opt.id);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-m rounded-lg px-m py-s text-left transition-colors ${
                    active
                      ? "bg-sunk-light text-text-neutral-primary dark:bg-elevated"
                      : "text-text-neutral-secondary active:bg-sunk-light dark:active:bg-elevated"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-medium">{opt.label}</p>
                    {opt.description ? (
                      <p className="truncate font-body text-sm text-text-neutral-tertiary">
                        {opt.description}
                      </p>
                    ) : null}
                  </div>
                  {active ? (
                    <Check size={18} className="shrink-0 text-text-neutral-primary" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {footer ? <div className="px-ml pt-s">{footer}</div> : null}
      </div>
    </div>
  );
}

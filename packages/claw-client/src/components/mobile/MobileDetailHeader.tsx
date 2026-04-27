"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";

interface TitlePart {
  label: string;
  /** When set, the part renders as a tappable button that opens a picker. */
  onTap?: () => void;
}

export interface MobileDetailHeaderProps {
  /** Primary label (left of the optional separator). */
  title: TitlePart;
  /** Optional secondary label (right of the separator). */
  subtitle?: TitlePart;
  /** Right slot — typically [primary CTA, kebab menu]. */
  actions?: ReactNode;
  onBack: () => void;
  backLabel?: string;
}

function TitleButton({ part }: { part: TitlePart }) {
  const className =
    "min-w-0 flex-shrink truncate font-body text-sm font-medium text-text-neutral-primary";
  if (part.onTap) {
    return (
      <button
        type="button"
        onClick={part.onTap}
        className={`${className} active:text-text-neutral-secondary`}
      >
        {part.label}
      </button>
    );
  }
  return <span className={className}>{part.label}</span>;
}

export function MobileDetailHeader({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
}: MobileDetailHeaderProps) {
  return (
    <header
      className="flex shrink-0 items-center gap-s border-b border-border-default/50 bg-background px-ml py-m dark:border-border-default/16"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
    >
      <HeaderIconButton onClick={onBack} label={backLabel}>
        <ArrowLeft size={18} />
      </HeaderIconButton>
      <div className="flex min-w-0 flex-1 items-center gap-xs">
        <TitleButton part={title} />
        {subtitle ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-px shrink-0 bg-border-default dark:bg-border-default/16"
            />
            <TitleButton part={subtitle} />
          </>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-s">{actions}</div> : null}
    </header>
  );
}

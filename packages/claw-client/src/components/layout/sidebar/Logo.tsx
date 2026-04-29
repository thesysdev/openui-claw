"use client";

export interface LogoProps {
  name: string;
  /** Optional secondary word rendered in a muted tone (e.g. "UI"). */
  suffix?: string;
  collapsed?: boolean;
}

/** Sidebar brand mark: app name (hidden when collapsed). */
export function Logo({ name, suffix, collapsed = false }: LogoProps) {
  const fade = collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]";
  return (
    <span
      className={`text-logo font-bold overflow-hidden whitespace-nowrap ${fade} transition-[opacity,max-width] duration-300 ease-out`}
    >
      <span className="text-text-neutral-primary">{name}</span>
      {suffix ? (
        <span className="ml-2xs font-medium text-text-neutral-tertiary">{suffix}</span>
      ) : null}
    </span>
  );
}

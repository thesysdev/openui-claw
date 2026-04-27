"use client";

export interface FilterChipOption<V extends string = string> {
  value: V;
  label: string;
  count?: number;
}

export interface FilterChipsProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<FilterChipOption<V>>;
  ariaLabel?: string;
}

/**
 * Horizontally-scrollable pill chip group with optional count badges.
 * Active chip is filled (primary text bg, background text); inactive chips
 * are subtle. Used by both the desktop NotifPanel and the mobile
 * notification inbox.
 */
export function FilterChips<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: FilterChipsProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex shrink-0 gap-xs overflow-x-auto"
    >
      {options.map(({ value: optValue, label, count }) => {
        const active = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(optValue)}
            className={`inline-flex h-7 shrink-0 items-center gap-2xs rounded-full border px-s font-label text-sm font-medium transition-colors ${
              active
                ? "border-border-default/70 bg-background text-text-neutral-primary shadow-sm dark:border-transparent dark:bg-elevated"
                : "border-transparent bg-sunk-light text-text-neutral-secondary active:bg-sunk dark:bg-foreground"
            }`}
          >
            <span>{label}</span>
            {typeof count === "number" ? (
              <span
                className={`inline-flex h-[12px] min-w-[12px] shrink-0 items-center justify-center rounded-full px-3xs font-label text-[8px] font-bold leading-none ${
                  active
                    ? "bg-text-neutral-primary text-background"
                    : "bg-sunk text-text-neutral-tertiary dark:bg-highlight-subtle"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

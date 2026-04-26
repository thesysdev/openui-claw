"use client";

export interface SortPillOption<Key extends string = string> {
  key: Key;
  label: string;
}

export interface SortPillsProps<Key extends string = string> {
  value: Key;
  options: ReadonlyArray<SortPillOption<Key>>;
  onChange: (next: Key) => void;
}

/**
 * Segmented sort/filter control. Container is a sunken pill; the active
 * option pops out with a lighter fill and a subtle shadow.
 */
export function SortPills<Key extends string>({
  value,
  options,
  onChange,
}: SortPillsProps<Key>) {
  return (
    <div className="inline-flex items-center rounded-full bg-sunk-light p-3xs dark:bg-foreground">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`inline-flex h-l items-center justify-center rounded-full px-m font-label text-sm transition-[background-color,color,box-shadow] duration-150 ${
              active
                ? "bg-background font-medium text-text-neutral-primary shadow-sm dark:bg-elevated-light"
                : "bg-transparent font-regular text-text-neutral-tertiary hover:text-text-neutral-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

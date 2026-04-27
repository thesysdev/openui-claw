"use client";

import type { ComponentType, ReactNode } from "react";

import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

export interface MobileMenuDrawerItem {
  key: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Optional header above the items (e.g. a SegmentedTabs control). */
  header?: ReactNode;
  items: MobileMenuDrawerItem[];
  title?: string;
}

function ItemIconTile({
  icon: Icon,
  destructive,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  destructive?: boolean;
}) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-default/70 bg-background shadow-sm dark:border-border-default/16 dark:bg-elevated-light ${
        destructive ? "text-text-danger-primary" : "text-text-neutral-tertiary"
      }`}
    >
      <Icon size={14} />
    </div>
  );
}

/**
 * Bottom-tray action menu (kebab → tray). Flat top edge, edge-to-edge
 * separators between items, each row inset 20px from the container with a
 * leading icon tile.
 */
export function MobileMenuDrawer({
  open,
  onClose,
  header,
  items,
  title,
}: MobileMenuDrawerProps) {
  useBodyScrollLock(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close menu"
        className="claw-fade-in flex-1 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="menu"
        className="claw-slide-up border-t border-border-default/50 bg-background shadow-2xl dark:border-border-default/16 dark:bg-foreground"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-s mt-s h-[3px] w-10 rounded-full bg-border-default/60 dark:bg-border-default/30" />
        {title ? (
          <h3 className="px-l pb-m text-sm font-medium text-text-neutral-tertiary">
            {title}
          </h3>
        ) : null}
        {header ? <div className="px-l pb-s">{header}</div> : null}
        <ul className="divide-y divide-border-default/50 px-l pt-xs dark:divide-border-default/16">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  className={`flex w-full items-center gap-m rounded-lg py-m text-left font-body text-sm font-medium transition-colors active:bg-sunk-light disabled:cursor-not-allowed disabled:opacity-50 dark:active:bg-elevated ${
                    item.destructive
                      ? "text-text-danger-primary"
                      : "text-text-neutral-secondary"
                  }`}
                >
                  {Icon ? (
                    <ItemIconTile icon={Icon} destructive={item.destructive} />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

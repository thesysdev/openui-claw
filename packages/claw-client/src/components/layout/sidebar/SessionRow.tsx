"use client";

import { CornerDownLeft, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";

export interface SessionRowProps {
  label: string;
  active?: boolean;
  hovered?: boolean;
  /** Non-main (extra) threads get the rename/delete dropdown. */
  isExtra?: boolean;
  busy?: boolean;
  /** Render an <input> instead of a button — used during inline rename. */
  editing?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

/**
 * A single session row under an expanded agent. Indented with a 24px spacer
 * so the active session's CornerDownLeft glyph sits where a tile would.
 */
export const SessionRow = forwardRef<HTMLInputElement, SessionRowProps>(
  (
    {
      label,
      active = false,
      hovered = false,
      isExtra = false,
      busy = false,
      editing = false,
      editValue = "",
      onEditChange,
      onEditCommit,
      onEditCancel,
      onClick,
      onDoubleClick,
      onMouseEnter,
      onMouseLeave,
      onRename,
      onDelete,
    },
    ref,
  ) => {
    const rowBg = hovered ? "bg-sunk-light" : "";
    return (
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`group flex h-8 items-center gap-s rounded-lg px-xs ${rowBg}`}
      >
        <div className="flex h-l w-l shrink-0 items-center justify-center">
          {active && (
            <CornerDownLeft
              size={11}
              className="text-text-neutral-primary"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
        </div>
        {editing ? (
          <input
            ref={ref}
            className="flex-1 min-w-0 bg-transparent text-sm text-text-neutral-primary outline-none"
            value={editValue}
            onChange={(e) => onEditChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEditCommit?.();
              } else if (e.key === "Escape") {
                onEditCancel?.();
              }
            }}
            onBlur={() => onEditCommit?.()}
            maxLength={64}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={onClick}
              onDoubleClick={isExtra && !busy ? onDoubleClick : undefined}
              className={`flex-1 truncate text-left text-sm ${
                active
                  ? "font-medium text-text-neutral-primary"
                  : hovered
                    ? "text-text-neutral-primary"
                    : "text-text-neutral-tertiary"
              }`}
            >
              {label}
            </button>
            {isExtra && !busy && (onRename || onDelete) && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-s text-text-neutral-tertiary opacity-0 transition-opacity hover:text-text-neutral-primary group-hover:opacity-100"
                  >
                    <EllipsisVertical size={13} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="openui-shell-thread-button-dropdown-menu"
                    side="bottom"
                    align="start"
                    sideOffset={2}
                  >
                    {onRename && (
                      <DropdownMenu.Item
                        className="openui-shell-thread-button-dropdown-menu-item"
                        onSelect={onRename}
                      >
                        <Pencil
                          size={14}
                          className="openui-shell-thread-button-dropdown-menu-item-icon"
                        />
                        Rename
                      </DropdownMenu.Item>
                    )}
                    {onDelete && (
                      <DropdownMenu.Item
                        className="openui-shell-thread-button-dropdown-menu-item"
                        onSelect={onDelete}
                      >
                        <Trash2
                          size={14}
                          className="openui-shell-thread-button-dropdown-menu-item-icon"
                        />
                        Delete
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </>
        )}
      </div>
    );
  },
);
SessionRow.displayName = "SessionRow";

"use client";

import { Cpu } from "lucide-react";
import type { ComponentType } from "react";

import { StatusDot } from "@/components/ui/StatusDot";

export type AgentStatus =
  | "idle"
  | "planning"
  | "executing"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "paused";

export interface AgentCardData {
  id: string;
  name: string;
  /** Icon component; defaults to `Cpu` if omitted. */
  icon?: ComponentType<{ size?: number; className?: string }>;
  status?: AgentStatus;
  /** Non-zero = shows a red dot next to the name. */
  unread?: number;
}

export interface AgentCardProps {
  agent: AgentCardData;
  onClick?: () => void;
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  planning: "Planning",
  executing: "Executing",
  awaiting_input: "Awaiting input",
  completed: "Completed",
  failed: "Failed",
  paused: "Paused",
};

const STATUS_DOT_CLASS: Record<AgentStatus, string> = {
  idle: "bg-text-neutral-tertiary",
  planning: "bg-text-info-primary",
  executing: "bg-text-success-primary",
  awaiting_input: "bg-text-alert-primary",
  completed: "bg-text-success-primary",
  failed: "bg-text-danger-primary",
  paused: "bg-text-neutral-secondary",
};

/**
 * Compact agent tile shown in the homepage "Top agents" grid.
 *
 * Visual: padded card, 36×36 category-tinted icon tile, agent name +
 * optional unread dot, status row with a colored dot. Hover lifts the
 * card (translateY + scale + card shadow).
 */
export function AgentCard({ agent, onClick }: AgentCardProps) {
  const Icon = agent.icon ?? Cpu;
  const status = agent.status ?? "idle";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-border-default/50 bg-popover-background p-m text-left shadow-xl transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:scale-[1.015] hover:shadow-card dark:border-transparent dark:bg-foreground dark:hover:bg-popover-background"
    >
      <div className="mb-s flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cat-agent/10 transition-colors duration-150">
        <Icon size={16} className="text-cat-agent" />
      </div>
      <div className="flex items-center gap-xs">
        <p className="truncate font-body text-sm font-medium text-text-neutral-primary">
          {agent.name}
        </p>
        {agent.unread && agent.unread > 0 ? (
          <StatusDot className="bg-text-danger-primary" size={6} />
        ) : null}
      </div>
      <div className="mt-3xs flex items-center gap-xs">
        <StatusDot className={STATUS_DOT_CLASS[status]} size={6} />
        <span className="font-body text-xs text-text-neutral-tertiary">{STATUS_LABEL[status]}</span>
      </div>
    </button>
  );
}

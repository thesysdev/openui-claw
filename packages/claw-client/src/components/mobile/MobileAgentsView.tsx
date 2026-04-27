"use client";

import { Cpu } from "lucide-react";
import type { Thread } from "@openuidev/react-headless";
import { useMemo, useState } from "react";

import { AgentCard, type AgentCardData } from "@/components/cards/AgentCard";
import { SectionHeader } from "@/components/home/SectionHeader";
import { SortButton } from "@/components/ui/SortButton";
import type { ClawThread } from "@/types/claw-thread";

type Sort = "recent" | "a-z";

interface AgentViewModel extends AgentCardData {
  latestThreadId?: string;
  latestUpdatedAt: number;
}

function buildAgents(threads: ClawThread[]): AgentViewModel[] {
  const map = new Map<
    string,
    { id: string; name: string; latestThreadId?: string; latestUpdatedAt: number }
  >();
  for (const t of threads) {
    const id = t.clawAgentId ?? t.id;
    const createdAt =
      typeof t.createdAt === "number" ? t.createdAt : Date.parse(String(t.createdAt)) || 0;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        id,
        name: t.clawKind === "main" ? t.title : id,
        latestThreadId: t.id,
        latestUpdatedAt: createdAt,
      });
    } else {
      if (t.clawKind === "main") existing.name = t.title;
      if (createdAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = createdAt;
        existing.latestThreadId = t.id;
      }
    }
  }
  return [...map.values()].map((g) => ({
    ...g,
    icon: Cpu,
    status: "idle" as const,
    unread: 0,
  }));
}

export interface AgentsViewProps {
  threads: Thread[];
  onOpenThread: (threadId: string) => void;
}

export function MobileAgentsView({ threads, onOpenThread }: AgentsViewProps) {
  const [sort, setSort] = useState<Sort>("recent");
  const agents = useMemo(() => buildAgents(threads as ClawThread[]), [threads]);

  const sorted = useMemo(() => {
    const arr = [...agents];
    if (sort === "a-z") arr.sort((a, b) => a.name.localeCompare(b.name));
    else arr.sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
    return arr;
  }, [agents, sort]);

  if (agents.length === 0) {
    return (
      <div
        className="flex h-full flex-1 items-center justify-center bg-background p-ml"
        style={{ minHeight: "calc(100dvh - 120px)" }}
      >
        <p className="text-center text-sm text-text-neutral-tertiary">
          No agents yet. Start a conversation to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="claw-fade-in h-full flex-1 overflow-y-auto bg-background p-ml">
      <div className="mx-auto max-w-[1080px]">
        <section className="mb-3xl">
          <SectionHeader
            title="All agents"
            right={<SortButton value={sort} onChange={setSort} />}
          />
          <div className="grid grid-cols-2 gap-s">
            {sorted.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onClick={() => {
                  if (a.latestThreadId) onOpenThread(a.latestThreadId);
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

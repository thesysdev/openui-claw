import type { TitleSwitcherItem } from "@/components/chat/TitleSwitcher";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { ClawThread } from "@/types/claw-thread";

/** Resolve a human-readable agent name from a thread list, falling back to the id. */
export function makeAgentNameResolver(threads: ClawThread[]) {
  return (agentId: string) =>
    threads.find(
      (t) => (t.clawAgentId ?? t.id) === agentId && t.clawKind === "main",
    )?.title ?? agentId;
}

export function buildAppSiblings(
  apps: AppSummary[],
  agentNameFor: (agentId: string) => string,
): TitleSwitcherItem[] {
  return apps.map((a) => ({
    id: a.id,
    label: a.title,
    trailingText: agentNameFor(a.agentId),
  }));
}

export function buildArtifactSiblings(
  artifacts: ArtifactSummary[],
  agentNameFor: (agentId: string) => string,
): TitleSwitcherItem[] {
  return artifacts.map((a) => ({
    id: a.id,
    label: a.title,
    trailingText: agentNameFor(a.source.agentId),
  }));
}

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Cpu, FileText, LayoutGrid, MessageSquare, Search } from "lucide-react";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { ClawThread } from "@/types/claw-thread";
import { appHash, artifactHash, chatHash } from "@/lib/hooks/useHashRoute";
import { IconTile } from "@/components/ui/IconTile";

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const DIALOG_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: 600,
  padding: 0,
  borderRadius: "var(--r-4xl)",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-popover)",
  color: "var(--color-text-primary)",
  boxShadow: "var(--shadow-float)",
  outline: "none",
  overflow: "hidden",
};

const SEARCH_BAR_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-s)",
  padding: "var(--sp-m) var(--sp-ml)",
  borderBottom: "1px solid var(--color-border)",
};

const SEARCH_INPUT_STYLE: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-md)",
};

const KBD_STYLE: CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-2xs)",
  fontWeight: "var(--fw-medium)",
  padding: "2px 6px",
  borderRadius: "var(--r-s)",
  color: "var(--color-text-tertiary)",
  border: "1px solid var(--color-border)",
  background: "var(--color-sunk-light)",
};

const LIST_STYLE: CSSProperties = {
  maxHeight: 420,
  overflowY: "auto",
  padding: "var(--sp-s) 0",
};

const GROUP_LABEL_STYLE: CSSProperties = {
  padding: "var(--sp-xs) var(--sp-ml)",
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-2xs)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
};

const EMPTY_STYLE: CSSProperties = {
  padding: "var(--sp-xl)",
  textAlign: "center",
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text-tertiary)",
};

// ── TYPES ──────────────────────────────────────────────────────────────────

type ItemKind = "agent" | "app" | "artifact";

interface Item {
  id: string;
  kind: ItemKind;
  title: string;
  subtitle?: string;
  href: string;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function matches(item: Item, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    item.title.toLowerCase().includes(lower) ||
    (item.subtitle ?? "").toLowerCase().includes(lower)
  );
}

function buildItems(
  threads: ClawThread[],
  apps: AppSummary[],
  artifacts: ArtifactSummary[],
): { agents: Item[]; apps: Item[]; artifacts: Item[] } {
  const agentsMap = new Map<string, Item>();
  for (const t of threads) {
    if (t.clawKind !== "main") continue;
    const aid = t.clawAgentId ?? t.id;
    agentsMap.set(aid, {
      id: aid,
      kind: "agent",
      title: t.title,
      subtitle: "Agent",
      href: chatHash(t.id),
    });
  }
  return {
    agents: [...agentsMap.values()],
    apps: apps.map((a) => ({
      id: a.id,
      kind: "app" as const,
      title: a.title,
      subtitle: a.agentId,
      href: appHash(a.id),
    })),
    artifacts: artifacts.map((a) => ({
      id: a.id,
      kind: "artifact" as const,
      title: a.title,
      subtitle: a.kind,
      href: artifactHash(a.id),
    })),
  };
}

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function RowItem({ item, onSelect }: { item: Item; onSelect: (item: Item) => void }) {
  const [hover, setHover] = useState(false);
  const Icon = item.kind === "agent" ? Cpu : item.kind === "app" ? LayoutGrid : FileText;
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(item)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-m)",
        padding: "var(--sp-s) var(--sp-ml)",
        background: hover ? "var(--color-sunk-light)" : "transparent",
        border: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
      }}
    >
      <IconTile icon={<Icon size={14} />} size="md" category={item.kind} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-medium)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        {item.subtitle ? (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-xs)",
              color: "var(--color-text-tertiary)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.subtitle}
          </div>
        ) : null}
      </div>
    </button>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  threads: ClawThread[];
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  onSelect: (href: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  threads,
  apps,
  artifacts,
  onSelect,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setTimeout(() => inputRef.current?.focus(), 10);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const groups = useMemo(() => buildItems(threads, apps, artifacts), [threads, apps, artifacts]);
  const filtered = useMemo(() => {
    return {
      agents: groups.agents.filter((i) => matches(i, q)),
      apps: groups.apps.filter((i) => matches(i, q)),
      artifacts: groups.artifacts.filter((i) => matches(i, q)),
    };
  }, [groups, q]);

  const totalCount = filtered.agents.length + filtered.apps.length + filtered.artifacts.length;

  const handleSelect = (item: Item) => {
    onSelect(item.href);
    onClose();
  };

  return (
    <dialog ref={dialogRef} style={DIALOG_STYLE} onClose={onClose}>
      <div style={SEARCH_BAR_STYLE}>
        <Search size={16} color="var(--color-text-tertiary)" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agents, apps, artifacts…"
          style={SEARCH_INPUT_STYLE}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <span style={KBD_STYLE}>Esc</span>
      </div>

      <div style={LIST_STYLE}>
        {totalCount === 0 ? (
          <div style={EMPTY_STYLE}>No matches.</div>
        ) : (
          <>
            {filtered.agents.length > 0 ? (
              <>
                <div style={GROUP_LABEL_STYLE}>
                  <MessageSquare
                    size={10}
                    style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
                  />
                  Agents
                </div>
                {filtered.agents.map((item) => (
                  <RowItem key={item.id} item={item} onSelect={handleSelect} />
                ))}
              </>
            ) : null}
            {filtered.apps.length > 0 ? (
              <>
                <div style={GROUP_LABEL_STYLE}>Apps</div>
                {filtered.apps.map((item) => (
                  <RowItem key={item.id} item={item} onSelect={handleSelect} />
                ))}
              </>
            ) : null}
            {filtered.artifacts.length > 0 ? (
              <>
                <div style={GROUP_LABEL_STYLE}>Artifacts</div>
                {filtered.artifacts.map((item) => (
                  <RowItem key={item.id} item={item} onSelect={handleSelect} />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </dialog>
  );
}

export default CommandPalette;

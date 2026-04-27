"use client";

import {
  ChevronRight,
  Database,
  FileText,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { ThreadUpload, LinkedAppContext } from "@/lib/session-workspace";

import { IconButton } from "@/components/layout/sidebar/IconButton";
import { TopBar } from "@/components/chat/TopBar";
import { NavTab } from "@/components/layout/sidebar/NavTab";
import { Tag } from "@/components/layout/sidebar/Tag";
import { SectionTab } from "@/components/layout/sidebar/SectionTab";
import { BorderTile, TextTile } from "@/components/layout/sidebar/Tile";
import { FilterChips } from "@/components/ui/FilterChips";

// Edge-to-edge separator: stretches past the pane's `px-s` padding so the
// 1px rule hits both side walls of the rail.
function EdgeSeparator() {
  return (
    <div className="-mx-s my-s h-px bg-border-default/50 dark:bg-border-default/16" />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function kindLabel(kind: string): string {
  switch (kind) {
    case "markdown":
      return "Doc";
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "code":
      return "Code";
    case "ppt":
      return "Slides";
    case "text":
      return "Text";
    default:
      return kind ? kind[0]!.toUpperCase() + kind.slice(1) : "File";
  }
}

// Thin wrapper around the shared navigation `Tag` so callers below can keep
// the `<TypeTag label="Doc" />` shorthand. Uses `size="sm"` to match the tag
// style used in the navigation sidebar agent rows.
function TypeTag({ label }: { label: string }) {
  return (
    <Tag size="sm" variant="neutral" className="uppercase tracking-wide">
      {label}
    </Tag>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Section — wraps a SectionTab with its animated collapse body.
// ────────────────────────────────────────────────────────────────────────────

function Section({
  id,
  icon,
  label,
  category,
  count,
  open,
  collapsed,
  onToggle,
  hoveredId,
  setHoveredId,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  category: "home" | "apps" | "artifacts" | "agents";
  count: number;
  open: boolean;
  collapsed?: boolean;
  onToggle: () => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-m">
      <SectionTab
        category={category}
        icon={icon}
        label={
          count > 0 ? `${label.toUpperCase()} · ${count}` : label.toUpperCase()
        }
        open={open}
        collapsed={collapsed}
        hovered={hoveredId === `${id}-head`}
        onClick={onToggle}
        onMouseEnter={() => setHoveredId(`${id}-head`)}
        onMouseLeave={() => setHoveredId(null)}
      />
      <div
        className={`overflow-hidden transition-[max-height,opacity] ${
          open
            ? "max-h-[1200px] opacity-100 duration-[350ms] ease-in"
            : "max-h-0 opacity-0 duration-[250ms] ease-out"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared props
// ────────────────────────────────────────────────────────────────────────────

export type WorkspacePaneProps = {
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
  pinnedAppIds: Set<string>;
  activePreviewId: string | null;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  onOpenApp: (appId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenUpload: (uploadId: string) => void;
  onTogglePinned: (appId: string) => void;
  onPickFiles: () => void;
};

// ────────────────────────────────────────────────────────────────────────────
// Workspace body — shared between the permanent sidepane and mobile drawer.
// ────────────────────────────────────────────────────────────────────────────

export function WorkspaceSections({
  apps,
  artifacts,
  uploads,
  linkedApp,
  activePreviewId,
  onOpenApp,
  onOpenArtifact,
  onOpenUpload,
  onPickFiles,
}: WorkspacePaneProps) {
  const [openMap, setOpenMap] = useState({
    apps: true,
    artifacts: true,
    context: true,
  });
  const [expandedMap, setExpandedMap] = useState<
    Partial<Record<"apps" | "artifacts", boolean>>
  >({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scope, setScope] = useState<"session" | "agent">("session");

  const toggle = (k: keyof typeof openMap) =>
    setOpenMap((p) => ({ ...p, [k]: !p[k] }));
  const toggleExpand = (k: "apps" | "artifacts") =>
    setExpandedMap((p) => ({ ...p, [k]: !p[k] }));

  const visibleApps = expandedMap.apps ? apps : apps.slice(0, 3);
  const visibleArts = expandedMap.artifacts ? artifacts : artifacts.slice(0, 3);

  const contextCount = uploads.length + (linkedApp ? 1 : 0);

  return (
    <div className="px-s pt-m">
      <div className="mb-m">
        <FilterChips<"session" | "agent">
          value={scope}
          onChange={setScope}
          options={[
            { value: "session", label: "This session" },
            { value: "agent", label: "All sessions" },
          ]}
          ariaLabel="Workspace scope"
        />
      </div>

      {/* Apps */}
      <Section
        id="apps"
        icon={LayoutGrid}
        label="Apps"
        category="apps"
        count={apps.length}
        open={openMap.apps}
        onToggle={() => toggle("apps")}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      >
        {apps.length === 0 ? (
          <EmptyBox label="No apps yet" />
        ) : (
          <>
            {visibleApps.map((app) => {
              const rowId = `app-${app.id}`;
              const isActive = activePreviewId === `session-app:${app.id}`;
              return (
                <NavTab
                  key={app.id}
                  tile={
                    <TextTile
                      label={app.title}
                      active={isActive}
                      category={isActive ? "apps" : null}
                    />
                  }
                  label={app.title}
                  active={isActive}
                  hovered={hoveredId === rowId}
                  onClick={() => onOpenApp(app.id)}
                  onMouseEnter={() => setHoveredId(rowId)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              );
            })}
            {apps.length > 3 ? (
              <NavTab
                tile={<BorderTile icon={ChevronRight} />}
                label={expandedMap.apps ? "View less" : `View all ${apps.length}`}
                muted
                hovered={hoveredId === "apps-viewall"}
                onClick={() => toggleExpand("apps")}
                onMouseEnter={() => setHoveredId("apps-viewall")}
                onMouseLeave={() => setHoveredId(null)}
              />
            ) : null}
          </>
        )}
      </Section>

      <EdgeSeparator />

      {/* Artifacts */}
      <Section
        id="artifacts"
        icon={FileText}
        label="Artifacts"
        category="artifacts"
        count={artifacts.length}
        open={openMap.artifacts}
        onToggle={() => toggle("artifacts")}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      >
        {artifacts.length === 0 ? (
          <EmptyBox label="No artifacts yet" />
        ) : (
          <>
            {visibleArts.map((artifact) => {
              const rowId = `art-${artifact.id}`;
              const isActive =
                activePreviewId === `session-artifact:${artifact.id}`;
              return (
                <NavTab
                  key={artifact.id}
                  tile={
                    <TextTile
                      label={artifact.title}
                      active={isActive}
                      category={isActive ? "artifacts" : null}
                    />
                  }
                  label={artifact.title}
                  active={isActive}
                  hovered={hoveredId === rowId}
                  onClick={() => onOpenArtifact(artifact.id)}
                  onMouseEnter={() => setHoveredId(rowId)}
                  onMouseLeave={() => setHoveredId(null)}
                  trailing={<TypeTag label={kindLabel(artifact.kind)} />}
                />
              );
            })}
            {artifacts.length > 3 ? (
              <NavTab
                tile={<BorderTile icon={ChevronRight} />}
                label={
                  expandedMap.artifacts
                    ? "View less"
                    : `View all ${artifacts.length}`
                }
                muted
                hovered={hoveredId === "arts-viewall"}
                onClick={() => toggleExpand("artifacts")}
                onMouseEnter={() => setHoveredId("arts-viewall")}
                onMouseLeave={() => setHoveredId(null)}
              />
            ) : null}
          </>
        )}
      </Section>

      <EdgeSeparator />

      {/* Context */}
      <Section
        id="context"
        icon={Database}
        label="Context"
        category="home" /* uses cat-context tint */
        count={contextCount}
        open={openMap.context}
        onToggle={() => toggle("context")}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
      >
        {contextCount === 0 ? (
          <EmptyBox
            label="No context yet"
            action={
              <button
                type="button"
                onClick={onPickFiles}
                className="inline-flex items-center gap-2xs rounded-m border border-border-default/70 bg-background px-s py-2xs font-label text-sm text-text-neutral-secondary shadow-sm transition-colors hover:bg-sunk-light hover:text-text-neutral-primary dark:border-border-default/16 dark:bg-foreground dark:hover:bg-elevated"
              >
                <Plus size={12} /> Add context
              </button>
            }
          />
        ) : (
          <>
            {linkedApp ? (() => {
              const isActive =
                activePreviewId === `session-app:${linkedApp.appId}`;
              return (
                <NavTab
                  tile={
                    <TextTile
                      label={linkedApp.title}
                      active={isActive}
                      category={isActive ? "apps" : null}
                    />
                  }
                  label={linkedApp.title}
                  active={isActive}
                  hovered={hoveredId === `ctx-linked`}
                  onClick={() => onOpenApp(linkedApp.appId)}
                  onMouseEnter={() => setHoveredId("ctx-linked")}
                  onMouseLeave={() => setHoveredId(null)}
                  trailing={<TypeTag label="App" />}
                />
              );
            })() : null}
            {uploads.map((upload) => {
              const rowId = `upload-${upload.id}`;
              const isActive =
                activePreviewId === `session-upload:${upload.id}`;
              return (
                <NavTab
                  key={upload.id}
                  tile={
                    <TextTile
                      label={upload.name}
                      active={isActive}
                      category={isActive ? "home" : null}
                    />
                  }
                  label={upload.name}
                  active={isActive}
                  hovered={hoveredId === rowId}
                  onClick={() => onOpenUpload(upload.id)}
                  onMouseEnter={() => setHoveredId(rowId)}
                  onMouseLeave={() => setHoveredId(null)}
                  trailing={<TypeTag label={kindLabel(upload.kind)} />}
                />
              );
            })}
            {/* Add-context affordance — mirrors the "View all" border-tile style. */}
            <NavTab
              tile={<BorderTile icon={Plus} />}
              label="Add context"
              muted
              hovered={hoveredId === "ctx-add"}
              onClick={onPickFiles}
              onMouseEnter={() => setHoveredId("ctx-add")}
              onMouseLeave={() => setHoveredId(null)}
            />
          </>
        )}
      </Section>
    </div>
  );
}

function EmptyBox({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="my-xs rounded-m border border-dashed border-border-default/70 px-s py-l text-center text-sm text-text-neutral-tertiary dark:border-border-default">
      <p>{label}</p>
      {action ? <div className="mt-s flex justify-center">{action}</div> : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Permanent side pane (desktop)
// ────────────────────────────────────────────────────────────────────────────

export function SessionWorkspacePane({ onCollapse, ...props }: WorkspacePaneProps) {
  return (
    <aside
      className="hidden h-full w-[260px] shrink-0 flex-col overflow-y-auto border-l border-border-default/50 bg-transparent dark:border-border-default/16 lg:flex"
    >
      <TopBar
        actions={
          onCollapse ? (
            <IconButton
              icon={PanelRightClose}
              variant="tertiary"
              size="md"
              title="Collapse thread workspace"
              onClick={onCollapse}
            />
          ) : null
        }
      >
        <span className="font-label text-md font-medium text-text-neutral-primary">
          Workspace
        </span>
      </TopBar>
      <WorkspaceSections {...props} onCollapse={onCollapse} />
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Mobile drawer
// ────────────────────────────────────────────────────────────────────────────

export function SessionWorkspaceDrawer({
  open,
  onClose,
  ...props
}: WorkspacePaneProps & {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex lg:hidden ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={`flex-1 bg-overlay backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-label="Close thread workspace"
      />
      <div
        className={`flex h-full w-[min(92vw,260px)] flex-col overflow-y-auto border-l border-border-default/50 bg-background shadow-xl transition-transform duration-300 ease-out dark:border-border-default/16 dark:bg-foreground ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex min-h-[52px] items-center justify-between px-s pt-ml pb-m">
          <div className="flex items-center gap-2 pl-xs">
            <div className="flex h-l w-l items-center justify-center rounded-m border border-border-default/70 bg-background shadow-sm dark:border-border-default/16 dark:bg-elevated-light">
              <PanelRightOpen size={11} className="text-text-neutral-tertiary" />
            </div>
            <span className="font-label text-xs font-medium text-text-neutral-tertiary">
              Workspace
            </span>
          </div>
          <IconButton
            icon={X}
            variant="tertiary"
            size="md"
            title="Close thread workspace"
            onClick={onClose}
          />
        </div>
        <WorkspaceSections {...props} />
      </div>
    </div>
  );
}

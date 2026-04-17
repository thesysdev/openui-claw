"use client";

import {
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  LayoutGrid,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  ScrollText,
  X,
} from "lucide-react";
import type { AppSummary, ArtifactSummary } from "@/lib/engines/types";
import type { ThreadUpload, LinkedAppContext } from "@/lib/session-workspace";

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

function kindIcon(kind: string) {
  switch (kind) {
    case "image":
      return FileImage;
    case "code":
      return FileCode2;
    case "markdown":
    case "pdf":
    case "text":
      return FileText;
    default:
      return FileArchive;
  }
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-100 via-white to-sky-100 text-zinc-700 dark:from-zinc-800 dark:via-zinc-900 dark:to-sky-500/20 dark:text-zinc-100">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{count}</span>
        {action}
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-zinc-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      {label}
    </span>
  );
}

function Row({
  icon: Icon,
  title,
  badge,
  active = false,
  onClick,
  trailing,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
  trailing?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-sky-200/80 bg-sky-50/80 dark:border-sky-500/30 dark:bg-sky-500/10"
          : "border-transparent hover:border-zinc-200/80 hover:bg-white/70 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/70"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-100 via-white to-sky-100 text-zinc-700 dark:from-zinc-800 dark:via-zinc-900 dark:to-sky-500/20 dark:text-zinc-100">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </div>
          )}
        </div>
      </button>
      {badge ? <Badge label={badge} /> : null}
      {trailing}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-200/80 bg-white/55 px-3 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/35 dark:text-zinc-500">
      {label}
    </div>
  );
}

type WorkspacePaneProps = {
  apps: AppSummary[];
  artifacts: ArtifactSummary[];
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
  pinnedAppIds: Set<string>;
  activePreviewId: string | null;
  onCollapse?: () => void;
  onOpenApp: (appId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenUpload: (uploadId: string) => void;
  onTogglePinned: (appId: string) => void;
  onPickFiles: () => void;
};

function WorkspaceSections({
  apps,
  artifacts,
  uploads,
  linkedApp,
  pinnedAppIds,
  activePreviewId,
  onOpenApp,
  onOpenArtifact,
  onOpenUpload,
  onTogglePinned,
  onPickFiles,
}: WorkspacePaneProps) {
  return (
    <div className="space-y-5">
      <section>
        <SectionHeader icon={LayoutGrid} title="Apps" count={apps.length} />
        <div className="space-y-2">
          {apps.length === 0 ? (
            <EmptyState label="Apps created in this thread will show up here." />
          ) : (
            apps.map((app) => (
              <Row
                key={app.id}
                icon={LayoutGrid}
                title={app.title}
                subtitle={app.agentId}
                active={activePreviewId === `session-app:${app.id}`}
                onClick={() => onOpenApp(app.id)}
                trailing={
                  <button
                    type="button"
                    className={`rounded-lg p-1 ${
                      pinnedAppIds.has(app.id)
                        ? "text-sky-500"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTogglePinned(app.id);
                    }}
                    title={pinnedAppIds.has(app.id) ? "Unpin app" : "Pin app"}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                }
                badge={pinnedAppIds.has(app.id) ? "Pinned" : undefined}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <SectionHeader icon={ScrollText} title="Artifacts" count={artifacts.length} />
        <div className="space-y-2">
          {artifacts.length === 0 ? (
            <EmptyState label="Artifacts created in this thread will show up here." />
          ) : (
            artifacts.map((artifact) => {
              const Icon = kindIcon(artifact.kind);
              return (
                <Row
                  key={artifact.id}
                  icon={Icon}
                  title={artifact.title}
                  subtitle={artifact.source.agentId}
                  badge={kindLabel(artifact.kind)}
                  active={activePreviewId === `session-artifact:${artifact.id}`}
                  onClick={() => onOpenArtifact(artifact.id)}
                />
              );
            })
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Paperclip}
          title="Context"
          count={uploads.length + (linkedApp ? 1 : 0)}
          action={
            <button
              type="button"
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              onClick={onPickFiles}
              title="Add files"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="space-y-2">
          {linkedApp ? (
            <Row
              icon={LayoutGrid}
              title={linkedApp.title}
              subtitle="Linked refine target"
              badge="App"
              active={activePreviewId === `session-app:${linkedApp.appId}`}
              onClick={() => onOpenApp(linkedApp.appId)}
            />
          ) : null}
          {uploads.map((upload) => {
            const Icon = kindIcon(upload.kind);
            return (
              <Row
                key={upload.id}
                icon={Icon}
                title={upload.name}
                subtitle={upload.status === "pending" ? "Ready to send" : "Attached to thread"}
                badge={kindLabel(upload.kind)}
                active={activePreviewId === `session-upload:${upload.id}`}
                onClick={() => onOpenUpload(upload.id)}
              />
            );
          })}
          {uploads.length === 0 && !linkedApp ? (
            <EmptyState label="Files you attach to this thread persist here as reusable context." />
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function SessionWorkspacePane({ onCollapse, ...props }: WorkspacePaneProps) {
  return (
    <aside className="hidden h-full w-[312px] shrink-0 border-l border-zinc-200/70 bg-gradient-to-b from-white/96 via-white/94 to-slate-50/65 dark:border-zinc-800 dark:from-zinc-950/90 dark:via-zinc-950/84 dark:to-slate-950/30 lg:flex lg:flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
        <div>
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Thread Workspace
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Apps, artifacts, and context
          </div>
        </div>
        {onCollapse ? (
          <button
            type="button"
            className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-white/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onCollapse}
            aria-label="Collapse thread workspace"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <WorkspaceSections {...props} onCollapse={onCollapse} />
      </div>
    </aside>
  );
}

export function SessionWorkspaceDrawer({
  open,
  onClose,
  ...props
}: WorkspacePaneProps & {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <button
        type="button"
        className="flex-1 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close thread workspace"
      />
      <div className="flex h-full w-[min(92vw,360px)] flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <PanelRightOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Thread Workspace
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Apps, artifacts, and context
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onClose}
            aria-label="Close thread workspace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <WorkspaceSections {...props} />
        </div>
      </div>
    </div>
  );
}

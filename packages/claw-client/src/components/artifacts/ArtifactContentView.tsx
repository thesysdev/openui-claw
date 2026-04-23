"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, FileCode2, FileImage, FileArchive } from "lucide-react";
import { inferWorkspacePreviewKind } from "@/lib/session-workspace";

function resolveTextContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (content == null) return null;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function looksLikeRenderableUrl(value: string): boolean {
  return /^(data:|blob:|https?:\/\/|\/)/.test(value);
}

function resolvePreviewSource(content: unknown, metadata?: Record<string, unknown>): string | null {
  if (typeof content === "string" && looksLikeRenderableUrl(content)) return content;
  const candidates = [
    metadata?.url,
    metadata?.href,
    metadata?.previewUrl,
    metadata?.dataUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && looksLikeRenderableUrl(candidate)) return candidate;
  }
  return null;
}

export function ArtifactContentView({
  title,
  kind,
  content,
  metadata,
}: {
  title: string;
  kind: string;
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  const name = typeof metadata?.fileName === "string" ? metadata.fileName : title;
  const mimeType = typeof metadata?.mimeType === "string" ? metadata.mimeType : "";
  const resolvedKind = inferWorkspacePreviewKind(name, mimeType, kind);
  const textContent = resolveTextContent(content);
  const previewSource = resolvePreviewSource(content, metadata);

  if (resolvedKind === "markdown" && textContent) {
    return (
      <div className="prose prose-sm max-w-none px-4 py-4 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
      </div>
    );
  }

  if (resolvedKind === "image" && previewSource) {
    return (
      <div className="flex h-full items-center justify-center bg-inverted-background/40 p-ml">
        <img
          src={previewSource}
          alt={title}
          className="max-h-full max-w-full rounded-xl border border-border-default object-contain shadow-xl"
        />
      </div>
    );
  }

  if (resolvedKind === "pdf" && previewSource) {
    return (
      <iframe
        src={previewSource}
        title={title}
        className="h-full min-h-[520px] w-full rounded-b-xl border-0 bg-background"
      />
    );
  }

  if ((resolvedKind === "code" || resolvedKind === "text") && textContent) {
    return (
      <pre className="h-full overflow-auto rounded-b-xl bg-inverted-background p-ml text-sm text-text-white">
        {textContent}
      </pre>
    );
  }

  if (resolvedKind === "ppt") {
    return (
      <div className="flex h-full items-center justify-center p-xl">
        <div className="max-w-sm rounded-2xl border border-border-default bg-background p-xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
            <FileArchive className="h-6 w-6 text-text-neutral-tertiary" />
          </div>
          <h3 className="text-sm font-semibold text-text-neutral-primary">
            Preview coming soon
          </h3>
          <p className="mt-2 text-sm text-text-neutral-tertiary">
            This presentation is stored and available in the workspace, but slide rendering is not wired yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-xl">
      <div className="max-w-md rounded-2xl border border-border-default bg-background p-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
            {resolvedKind === "image" ? (
              <FileImage className="h-5 w-5 text-text-neutral-tertiary" />
            ) : resolvedKind === "code" ? (
              <FileCode2 className="h-5 w-5 text-text-neutral-tertiary" />
            ) : (
              <FileText className="h-5 w-5 text-text-neutral-tertiary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-neutral-primary">
              {title}
            </p>
            <p className="truncate text-sm text-text-neutral-tertiary">
              {mimeType || kind || "File"}
            </p>
          </div>
        </div>
        {textContent ? (
          <pre className="max-h-[420px] overflow-auto rounded-xl bg-inverted-background p-ml text-sm text-text-white">
            {textContent}
          </pre>
        ) : (
          <p className="text-sm text-text-neutral-tertiary">
            This file type does not have a rich preview yet.
          </p>
        )}
      </div>
    </div>
  );
}

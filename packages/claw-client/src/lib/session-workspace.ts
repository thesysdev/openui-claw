"use client";

import { separateContentAndContext } from "@/lib/content-parser";

export type WorkspacePreviewKind =
  | "image"
  | "pdf"
  | "markdown"
  | "code"
  | "text"
  | "ppt"
  | "file";

export type GatewayAttachmentPayload = {
  type?: string;
  mimeType: string;
  fileName: string;
  content: string;
};

export type ThreadUploadStatus = "pending" | "sent";

export type ThreadUpload = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: WorkspacePreviewKind;
  attachment?: GatewayAttachmentPayload;
  previewUrl?: string;
  textContent?: string;
  createdAt: number;
  status: ThreadUploadStatus;
};

export type LinkedAppContext = {
  appId: string;
  title: string;
  agentId: string;
  sessionKey: string;
};

export type ThreadWorkspaceState = {
  uploads: ThreadUpload[];
  linkedApp: LinkedAppContext | null;
};

type ThreadUploadContextEntry = {
  type: "thread_uploads";
  files: Array<{
    id: string;
    name: string;
    mimeType?: string;
    size?: number;
    kind?: string;
    status?: string;
    createdAt?: number;
  }>;
};

type LinkedAppContextEntry = {
  type: "linked_app";
  appId: string;
  title: string;
  agentId: string;
  sessionKey: string;
};

type ThreadContextEntry = ThreadUploadContextEntry | LinkedAppContextEntry;

type ThreadWorkspaceMessageLike = {
  role?: string;
  content?: unknown;
};

export const EMPTY_THREAD_WORKSPACE: ThreadWorkspaceState = {
  uploads: [],
  linkedApp: null,
};

function isTextLikeFile(name: string, mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("toml") ||
    /\.(c|cc|cpp|cs|css|go|html|java|js|json|jsx|kt|md|mjs|php|py|rb|rs|scss|sh|sql|svg|toml|ts|tsx|txt|xml|yaml|yml)$/i.test(
      name,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isLinkedAppContextEntry(value: unknown): value is LinkedAppContextEntry {
  return (
    isRecord(value) &&
    value.type === "linked_app" &&
    typeof value.appId === "string" &&
    typeof value.title === "string" &&
    typeof value.agentId === "string" &&
    typeof value.sessionKey === "string"
  );
}

function isThreadUploadContextEntry(value: unknown): value is ThreadUploadContextEntry {
  return (
    isRecord(value) &&
    value.type === "thread_uploads" &&
    Array.isArray(value.files)
  );
}

function parseThreadContextEntries(contextString: string | null): ThreadContextEntry[] {
  if (!contextString) return [];

  try {
    const parsed = JSON.parse(contextString);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ThreadContextEntry =>
        isLinkedAppContextEntry(entry) || isThreadUploadContextEntry(entry),
    );
  } catch {
    return [];
  }
}

function createThreadUploadPlaceholder(
  file: ThreadUploadContextEntry["files"][number],
  fallbackCreatedAt: number,
): ThreadUpload {
  const mimeType =
    typeof file.mimeType === "string" && file.mimeType.length > 0
      ? file.mimeType
      : "application/octet-stream";
  const name = typeof file.name === "string" && file.name.length > 0 ? file.name : "Attachment";

  return {
    id: file.id,
    name,
    mimeType,
    size: typeof file.size === "number" ? file.size : 0,
    kind: inferWorkspacePreviewKind(name, mimeType, file.kind),
    createdAt: typeof file.createdAt === "number" ? file.createdAt : fallbackCreatedAt,
    status: file.status === "pending" ? "pending" : "sent",
  };
}

export function inferWorkspacePreviewKind(
  name: string,
  mimeType: string,
  kind?: string,
): WorkspacePreviewKind {
  const loweredKind = (kind ?? "").toLowerCase();
  if (loweredKind === "markdown") return "markdown";
  if (loweredKind === "image") return "image";
  if (loweredKind === "pdf") return "pdf";
  if (loweredKind === "code") return "code";
  if (loweredKind === "ppt" || loweredKind === "pptx") return "ppt";

  const loweredName = name.toLowerCase();
  const loweredMime = mimeType.toLowerCase();

  if (loweredMime.startsWith("image/")) return "image";
  if (loweredMime === "application/pdf" || loweredName.endsWith(".pdf")) return "pdf";
  if (
    loweredMime.includes("powerpoint") ||
    loweredName.endsWith(".ppt") ||
    loweredName.endsWith(".pptx")
  ) {
    return "ppt";
  }
  if (loweredName.endsWith(".md") || loweredMime === "text/markdown") return "markdown";
  if (isTextLikeFile(name, mimeType)) {
    if (
      /\.(c|cc|cpp|cs|css|go|html|java|js|json|jsx|kt|mjs|php|py|rb|rs|scss|sh|sql|svg|toml|ts|tsx|xml|yaml|yml)$/i.test(
        loweredName,
      )
    ) {
      return "code";
    }
    return "text";
  }
  return "file";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function fileToThreadUpload(file: File): Promise<ThreadUpload> {
  const dataUrl = await readFileAsDataUrl(file);
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const kind = inferWorkspacePreviewKind(file.name, file.type);
  const canReadText = isTextLikeFile(file.name, file.type) && file.size <= 256_000;
  const textContent = canReadText ? await file.text().catch(() => undefined) : undefined;
  const previewUrl = kind === "image" || kind === "pdf" ? dataUrl : undefined;

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
    attachment: {
      type: kind,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
      content: base64,
    },
    previewUrl,
    textContent,
    createdAt: Date.now(),
    status: "pending",
  };
}

export function buildThreadContextPayload(params: {
  linkedApp?: LinkedAppContext | null;
  uploads?: ThreadUpload[];
}): unknown[] {
  const payload: unknown[] = [];

  if (params.linkedApp) {
    payload.push({
      type: "linked_app",
      appId: params.linkedApp.appId,
      title: params.linkedApp.title,
      agentId: params.linkedApp.agentId,
      sessionKey: params.linkedApp.sessionKey,
      instruction:
        "This thread is linked to the app above. Use get_app/app_update when the user asks to refine or modify it.",
    });
  }

  if (params.uploads && params.uploads.length > 0) {
    payload.push({
      type: "thread_uploads",
      files: params.uploads.map((upload) => ({
        id: upload.id,
        name: upload.name,
        mimeType: upload.mimeType,
        size: upload.size,
        kind: upload.kind,
        status: upload.status,
        createdAt: upload.createdAt,
      })),
    });
  }

  return payload;
}

export function deriveThreadWorkspaceFromMessages(
  messages: ThreadWorkspaceMessageLike[],
): ThreadWorkspaceState {
  const uploadsInOrder: string[] = [];
  const uploadsById = new Map<string, ThreadUpload>();
  let linkedApp: LinkedAppContext | null = null;

  messages.forEach((message, messageIndex) => {
    if (message.role !== "user" || typeof message.content !== "string") return;
    const { contextString } = separateContentAndContext(message.content);

    parseThreadContextEntries(contextString).forEach((entry) => {
      if (entry.type === "linked_app") {
        linkedApp = {
          appId: entry.appId,
          title: entry.title,
          agentId: entry.agentId,
          sessionKey: entry.sessionKey,
        };
        return;
      }

      entry.files.forEach((file, fileIndex) => {
        const fallbackCreatedAt = messageIndex * 1000 + fileIndex;
        const nextUpload = createThreadUploadPlaceholder(file, fallbackCreatedAt);
        const existing = uploadsById.get(file.id);

        if (!existing) {
          uploadsInOrder.push(file.id);
        }

        uploadsById.set(file.id, {
          ...(existing ?? {}),
          ...nextUpload,
          attachment: existing?.attachment,
          previewUrl: existing?.previewUrl,
          textContent: existing?.textContent,
        });
      });
    });
  });

  return {
    uploads: uploadsInOrder
      .map((id) => uploadsById.get(id))
      .filter((upload): upload is ThreadUpload => upload != null),
    linkedApp,
  };
}

export function mergeThreadWorkspaces(
  primary: ThreadWorkspaceState,
  fallback?: ThreadWorkspaceState | null,
): ThreadWorkspaceState {
  if (!fallback) return primary;

  const fallbackUploads = new Map(fallback.uploads.map((upload) => [upload.id, upload]));
  const uploads = primary.uploads.map((upload) => {
    const cached = fallbackUploads.get(upload.id);
    fallbackUploads.delete(upload.id);
    return {
      ...cached,
      ...upload,
      attachment: upload.attachment ?? cached?.attachment,
      previewUrl: upload.previewUrl ?? cached?.previewUrl,
      textContent: upload.textContent ?? cached?.textContent,
      createdAt: upload.createdAt || cached?.createdAt || Date.now(),
    };
  });

  const trailingUploads = [...fallbackUploads.values()].sort(
    (left, right) => left.createdAt - right.createdAt,
  );

  return {
    uploads: [...uploads, ...trailingUploads],
    linkedApp: primary.linkedApp ?? fallback.linkedApp ?? null,
  };
}

export function isThreadWorkspaceEmpty(workspace: ThreadWorkspaceState): boolean {
  return workspace.uploads.length === 0 && workspace.linkedApp == null;
}

export function sessionAppPreviewId(appId: string): string {
  return `session-app:${appId}`;
}

export function sessionArtifactPreviewId(artifactId: string): string {
  return `session-artifact:${artifactId}`;
}

export function sessionUploadPreviewId(uploadId: string): string {
  return `session-upload:${uploadId}`;
}

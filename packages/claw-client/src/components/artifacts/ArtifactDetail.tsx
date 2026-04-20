"use client";

import { ArtifactContentView } from "@/components/artifacts/ArtifactContentView";
import type { ArtifactRecord, ArtifactStore } from "@/lib/engines/types";
import { artifactsHash } from "@/lib/hooks/useHashRoute";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  artifactId: string;
  artifacts: ArtifactStore;
  updatedAt?: string;
  mode?: "page" | "panel";
  onDeleted?: () => void;
}

export function ArtifactDetail({
  artifactId,
  artifacts,
  updatedAt,
  mode = "page",
  onDeleted,
}: Props) {
  const [record, setRecord] = useState<ArtifactRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setRecord(null);
    artifacts
      .getArtifact(artifactId)
      .then((r) => {
        if (!r) setNotFound(true);
        else setRecord(r);
      })
      .finally(() => setLoading(false));
  }, [artifactId, artifacts, updatedAt]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Artifact not found</p>
        <a
          href={artifactsHash()}
          className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
        >
          ← Back to artifacts
        </a>
      </div>
    );
  }

  const contentDisplay =
    typeof record.content === "string" ? record.content : JSON.stringify(record.content, null, 2);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await artifacts.deleteArtifact(artifactId);
      if (mode === "page") {
        window.location.hash = artifactsHash();
      }
      onDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {mode === "page" && (
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <a
            href={artifactsHash()}
            className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Artifacts
          </a>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {record.title}
              </h1>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Durable artifact</p>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {record.kind}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
            {record.kind}
          </span>
          <span>{new Date(record.updatedAt).toLocaleString()}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Delete artifact"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <ArtifactContentView
          title={record.title}
          kind={record.kind}
          content={contentDisplay}
          metadata={record.metadata}
        />
      </div>
    </div>
  );
}

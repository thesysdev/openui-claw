"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { ArtifactRecord, ArtifactStore } from "@/lib/engines/types";
import { artifactsHash } from "@/lib/hooks/useHashRoute";

interface Props {
  artifactId: string;
  artifacts: ArtifactStore;
}

export function ArtifactDetail({ artifactId, artifacts }: Props) {
  const [record, setRecord] = useState<ArtifactRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    artifacts
      .getArtifact(artifactId)
      .then((r) => {
        if (!r) setNotFound(true);
        else setRecord(r);
      })
      .finally(() => setLoading(false));
  }, [artifactId, artifacts]);

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
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Artifact not found
        </p>
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
    typeof record.content === "string"
      ? record.content
      : JSON.stringify(record.content, null, 2);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await artifacts.deleteArtifact(artifactId);
      window.location.hash = artifactsHash();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <a
        href={artifactsHash()}
        className="mb-6 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <ArrowLeft className="h-3 w-3" />
        Artifacts
      </a>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {record.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {record.kind}
          </span>
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
            </>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Delete artifact"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        {(
          [
            ["Engine", record.source.engineId],
            ["Agent", record.source.agentId],
            ["Session", record.source.sessionId],
            ["Created", new Date(record.createdAt).toLocaleString()],
            ["Updated", new Date(record.updatedAt).toLocaleString()],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {label}
            </span>
            <span className="truncate text-zinc-700 dark:text-zinc-300">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-2.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Content
        </div>
        <pre className="overflow-auto p-4 text-xs text-zinc-800 dark:text-zinc-200">
          {contentDisplay}
        </pre>
      </div>
    </div>
  );
}

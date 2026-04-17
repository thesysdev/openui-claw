"use client";

import {
  EMPTY_THREAD_WORKSPACE,
  isThreadWorkspaceEmpty,
  type ThreadWorkspaceState,
} from "@/lib/session-workspace";

const DB_NAME = "openui-claw-workspace";
const DB_VERSION = 1;
const STORE_NAME = "thread-workspaces";

type PersistedThreadWorkspaceRecord = {
  threadId: string;
  workspace: ThreadWorkspaceState;
  updatedAt: number;
};

function canUseIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openWorkspaceDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "threadId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open workspace cache"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> {
  const db = await openWorkspaceDb();
  if (!db) return null;

  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    return await action(store);
  } finally {
    db.close();
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function loadThreadWorkspaceCache(
  threadId: string,
): Promise<ThreadWorkspaceState | null> {
  const record = await withStore("readonly", async (store) => {
    const result = await requestToPromise<PersistedThreadWorkspaceRecord | undefined>(
      store.get(threadId),
    );
    return result ?? null;
  });

  return record?.workspace ?? null;
}

export async function saveThreadWorkspaceCache(
  threadId: string,
  workspace: ThreadWorkspaceState,
): Promise<void> {
  if (isThreadWorkspaceEmpty(workspace)) {
    await clearThreadWorkspaceCache(threadId);
    return;
  }

  await withStore("readwrite", async (store) => {
    await requestToPromise(
      store.put({
        threadId,
        workspace,
        updatedAt: Date.now(),
      } satisfies PersistedThreadWorkspaceRecord),
    );
  });
}

export async function clearThreadWorkspaceCache(threadId: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(threadId));
  });
}

export async function removeThreadUploadFromCache(
  threadId: string,
  uploadId: string,
): Promise<ThreadWorkspaceState> {
  const current = (await loadThreadWorkspaceCache(threadId)) ?? EMPTY_THREAD_WORKSPACE;
  const next = {
    ...current,
    uploads: current.uploads.filter((upload) => upload.id !== uploadId),
  };

  await saveThreadWorkspaceCache(threadId, next);
  return next;
}

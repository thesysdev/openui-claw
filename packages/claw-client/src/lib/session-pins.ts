/**
 * Tracks which thread IDs the user has pinned. Pure client-side; the
 * gateway has no concept of pinning so we just keep a `Set<string>`
 * keyed by thread id in localStorage.
 *
 * The shape mirrors `lib/app-pins.ts`, but lives separately so a future
 * server-side pin feature can replace this implementation without
 * touching app pins.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "claw-session-pins-v1";

let cached: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cached) return cached;
  if (typeof localStorage === "undefined") {
    cached = new Set();
    return cached;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = new Set();
      return cached;
    }
    const parsed = JSON.parse(raw) as unknown;
    cached = Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
    return cached;
  } catch {
    cached = new Set();
    return cached;
  }
}

function write(next: Set<string>): void {
  cached = next;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }
  for (const fn of listeners) fn();
}

export function getPinnedThreadIds(): Set<string> {
  return read();
}

export function isPinnedThread(id: string): boolean {
  return read().has(id);
}

export function togglePinnedThread(id: string): boolean {
  const current = new Set(read());
  if (current.has(id)) {
    current.delete(id);
    write(current);
    return false;
  }
  current.add(id);
  write(current);
  return true;
}

export function subscribePinnedThreads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY = new Set<string>();
export function usePinnedThreadIds(): Set<string> {
  return useSyncExternalStore(subscribePinnedThreads, getPinnedThreadIds, () => EMPTY);
}

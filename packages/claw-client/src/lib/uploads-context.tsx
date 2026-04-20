"use client";

import type { UploadMeta, UploadStore } from "@/lib/engines/types";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type UploadsContextValue = {
  store: UploadStore | null;
  /** Upload metadata indexed by remoteId, seeded from uploads.list for the current session. */
  metasById: Map<string, UploadMeta>;
  getPreviewDataUrl: (remoteId: string) => Promise<string | null>;
};

const UploadsContext = createContext<UploadsContextValue>({
  store: null,
  metasById: new Map(),
  getPreviewDataUrl: async () => null,
});

export type UploadsSeed = {
  /** Meta pushed locally as soon as `uploads.put` resolves — merged over the `uploads.list` result. */
  meta: UploadMeta;
  /** Base64 preview synthesized from the originally-picked File so the first render gets a thumbnail without a plugin round-trip. */
  previewDataUrl?: string;
};

export function UploadsProvider({
  children,
  store,
  sessionKey,
  seeds = [],
}: {
  children: React.ReactNode;
  store: UploadStore | undefined;
  sessionKey: string | null;
  /**
   * Locally-put uploads that may not be in the server's `listUploads` response
   * yet. Merged in by remoteId so `useUploadMeta` resolves immediately after
   * the put resolves, without waiting for a refetch.
   */
  seeds?: UploadsSeed[];
}) {
  const [metas, setMetas] = useState<UploadMeta[]>([]);
  const [blobCache] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    if (!store || !sessionKey) {
      setMetas([]);
      return;
    }
    let cancelled = false;
    void store.listUploads(sessionKey).then((list) => {
      if (!cancelled) setMetas(list);
    });
    return () => {
      cancelled = true;
    };
  }, [store, sessionKey]);

  // Scope seeds to the current session so stale entries from a prior thread
  // don't bleed into the `metasById` lookup.
  const scopedSeeds = useMemo(
    () => (sessionKey ? seeds.filter((seed) => seed.meta.sessionKey === sessionKey) : []),
    [seeds, sessionKey],
  );

  // Seed the blob cache with any data URLs the caller already has on hand,
  // so `InlineUploadChip` renders a thumbnail on first paint instead of waiting
  // for `uploads.get` to round-trip through the plugin.
  useEffect(() => {
    for (const seed of scopedSeeds) {
      if (seed.previewDataUrl && !blobCache.has(seed.meta.id)) {
        blobCache.set(seed.meta.id, seed.previewDataUrl);
      }
    }
  }, [scopedSeeds, blobCache]);

  const value = useMemo<UploadsContextValue>(() => {
    const combined = new Map<string, UploadMeta>();
    for (const meta of metas) combined.set(meta.id, meta);
    for (const seed of scopedSeeds) combined.set(seed.meta.id, seed.meta);
    return {
      store: store ?? null,
      metasById: combined,
      getPreviewDataUrl: async (remoteId: string) => {
        if (blobCache.has(remoteId)) return blobCache.get(remoteId) ?? null;
        if (!store) return null;
        const record = await store.getUpload(remoteId);
        if (!record) return null;
        const dataUrl = `data:${record.mimeType};base64,${record.content}`;
        blobCache.set(remoteId, dataUrl);
        return dataUrl;
      },
    };
  }, [blobCache, metas, scopedSeeds, store]);

  return <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>;
}

export function useUploadsContext(): UploadsContextValue {
  return useContext(UploadsContext);
}

export function useUploadMeta(remoteId: string | undefined): UploadMeta | null {
  const { metasById } = useUploadsContext();
  if (!remoteId) return null;
  return metasById.get(remoteId) ?? null;
}

export function useUploadPreview(remoteId: string | undefined): string | null {
  const { getPreviewDataUrl } = useUploadsContext();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteId) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    void getPreviewDataUrl(remoteId).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [getPreviewDataUrl, remoteId]);

  return dataUrl;
}

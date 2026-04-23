"use client";

import {
  AppDetail,
  type AppContinueConversationHandler,
} from "@/components/apps/AppDetail";
import { ArtifactContentView } from "@/components/artifacts/ArtifactContentView";
import { ArtifactDetail } from "@/components/artifacts/ArtifactDetail";
import type {
  AppRecord,
  AppStore,
  AppSummary,
  ArtifactStore,
  ArtifactSummary,
  UploadStore,
} from "@/lib/engines/types";
import type { LinkedAppContext, ThreadUpload } from "@/lib/session-workspace";
import {
  sessionAppPreviewId,
  sessionArtifactPreviewId,
  sessionUploadPreviewId,
} from "@/lib/session-workspace";
import { ArtifactPanel } from "@openuidev/react-ui";
import { useEffect, useMemo, useState } from "react";

function UploadPreviewPanel({
  upload,
  uploadStore,
}: {
  upload: ThreadUpload;
  uploadStore?: UploadStore;
}) {
  const [fetchedDataUrl, setFetchedDataUrl] = useState<string | null>(null);

  const immediatePreview = upload.textContent ?? upload.previewUrl ?? null;

  useEffect(() => {
    // Always drop prior fetched bytes first so a panel that was remounted with
    // a different upload id can't flash the previous file's preview.
    setFetchedDataUrl(null);
    if (immediatePreview) return;
    if (!uploadStore || !upload.remoteId) return;
    let cancelled = false;
    void uploadStore.getUpload(upload.remoteId).then((record) => {
      if (cancelled || !record) return;
      setFetchedDataUrl(`data:${record.mimeType};base64,${record.content}`);
    });
    return () => {
      cancelled = true;
    };
  }, [immediatePreview, upload.remoteId, uploadStore]);

  const content = immediatePreview ?? fetchedDataUrl;

  return (
    <ArtifactContentView
      title={upload.name}
      kind={upload.kind}
      content={content}
      metadata={{
        fileName: upload.name,
        mimeType: upload.mimeType,
        previewUrl: content ?? undefined,
        size: upload.size,
        status: upload.status,
      }}
    />
  );
}

export function SessionPreviewPanels({
  apps,
  allApps,
  linkedApp,
  artifacts,
  uploads,
  appStore,
  artifactStore,
  uploadStore,
  pinnedAppIds,
  onTogglePinned,
  onRefineApp,
  onAppContinueConversation,
  onRefreshApps,
  onRefreshArtifacts,
}: {
  apps: AppSummary[];
  allApps: AppSummary[];
  linkedApp: LinkedAppContext | null;
  artifacts: ArtifactSummary[];
  uploads: ThreadUpload[];
  appStore?: AppStore;
  artifactStore?: ArtifactStore;
  uploadStore?: UploadStore;
  pinnedAppIds: Set<string>;
  onTogglePinned: (appId: string) => void;
  onRefineApp: (record: AppRecord) => void | Promise<void>;
  onAppContinueConversation?: AppContinueConversationHandler;
  onRefreshApps: () => void;
  onRefreshArtifacts: () => void;
}) {
  const resolvedApps = useMemo(() => {
    // Prefer the global summary copy so panel keys pick up refreshed `updatedAt` values.
    const latestAppsById = new Map(allApps.map((app) => [app.id, app]));
    return apps.map((app) => latestAppsById.get(app.id) ?? app);
  }, [allApps, apps]);

  const resolvedLinkedApp = useMemo(() => {
    if (!linkedApp) return null;

    return (
      allApps.find((app) => app.id === linkedApp.appId) ??
      resolvedApps.find((app) => app.id === linkedApp.appId) ?? {
        id: linkedApp.appId,
        title: linkedApp.title,
        agentId: linkedApp.agentId,
        sessionKey: linkedApp.sessionKey,
        createdAt: "",
        updatedAt: "",
      }
    );
  }, [allApps, linkedApp, resolvedApps]);

  const appPanels = useMemo(() => {
    if (!resolvedLinkedApp) {
      return resolvedApps;
    }

    const linkedIndex = resolvedApps.findIndex((app) => app.id === resolvedLinkedApp.id);
    if (linkedIndex === -1) {
      return [resolvedLinkedApp, ...resolvedApps];
    }

    return resolvedApps.map((app) => (app.id === resolvedLinkedApp.id ? resolvedLinkedApp : app));
  }, [resolvedApps, resolvedLinkedApp]);

  return (
    <>
      {appStore &&
        appPanels.map((app) => (
          <ArtifactPanel
            key={`${app.id}:${app.updatedAt}`}
            artifactId={sessionAppPreviewId(app.id)}
            title={app.title}
          >
            <div className="h-full overflow-hidden">
              <AppDetail
                appId={app.id}
                apps={appStore}
                updatedAt={app.updatedAt}
                mode="panel"
                isPinned={pinnedAppIds.has(app.id)}
                onTogglePinned={onTogglePinned}
                onRefine={onRefineApp}
                onContinueConversation={onAppContinueConversation}
                onDeleted={onRefreshApps}
              />
            </div>
          </ArtifactPanel>
        ))}

      {artifactStore &&
        artifacts.map((artifact) => (
          <ArtifactPanel
            key={`${artifact.id}:${artifact.updatedAt}`}
            artifactId={sessionArtifactPreviewId(artifact.id)}
            title={artifact.title}
          >
            <div className="h-full overflow-hidden">
              <ArtifactDetail
                artifactId={artifact.id}
                artifacts={artifactStore}
                updatedAt={artifact.updatedAt}
                mode="panel"
                onDeleted={onRefreshArtifacts}
              />
            </div>
          </ArtifactPanel>
        ))}

      {uploads.map((upload) => (
        <ArtifactPanel
          key={upload.id}
          artifactId={sessionUploadPreviewId(upload.id)}
          title={upload.name}
        >
          <div className="h-full overflow-auto bg-sunk-light">
            <UploadPreviewPanel upload={upload} uploadStore={uploadStore} />
          </div>
        </ArtifactPanel>
      ))}
    </>
  );
}

"use client";

import { useMemo } from "react";
import { ArtifactPanel } from "@openuidev/react-ui";
import { AppDetail } from "@/components/apps/AppDetail";
import { ArtifactDetail } from "@/components/artifacts/ArtifactDetail";
import { ArtifactContentView } from "@/components/artifacts/ArtifactContentView";
import type { AppRecord, AppStore, AppSummary, ArtifactStore, ArtifactSummary } from "@/lib/engines/types";
import type { LinkedAppContext, ThreadUpload } from "@/lib/session-workspace";
import {
  sessionAppPreviewId,
  sessionArtifactPreviewId,
  sessionUploadPreviewId,
} from "@/lib/session-workspace";

export function SessionPreviewPanels({
  apps,
  allApps,
  linkedApp,
  artifacts,
  uploads,
  appStore,
  artifactStore,
  pinnedAppIds,
  onTogglePinned,
  onRefineApp,
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
  pinnedAppIds: Set<string>;
  onTogglePinned: (appId: string) => void;
  onRefineApp: (record: AppRecord) => void | Promise<void>;
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
      return [
        resolvedLinkedApp,
        ...resolvedApps,
      ];
    }

    return resolvedApps.map((app) =>
      app.id === resolvedLinkedApp.id ? resolvedLinkedApp : app,
    );
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
                onDeleted={onRefreshApps}
              />
            </div>
          </ArtifactPanel>
        ))}

      {artifactStore &&
        artifacts.map((artifact) => (
          <ArtifactPanel
            key={artifact.id}
            artifactId={sessionArtifactPreviewId(artifact.id)}
            title={artifact.title}
          >
            <div className="h-full overflow-hidden">
              <ArtifactDetail
                artifactId={artifact.id}
                artifacts={artifactStore}
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
          <div className="h-full overflow-auto bg-zinc-50 dark:bg-zinc-950">
            <ArtifactContentView
              title={upload.name}
              kind={upload.kind}
              content={upload.textContent ?? upload.previewUrl ?? null}
              metadata={{
                fileName: upload.name,
                mimeType: upload.mimeType,
                previewUrl: upload.previewUrl,
                size: upload.size,
                status: upload.status,
              }}
            />
          </div>
        </ArtifactPanel>
      ))}
    </>
  );
}

"use client";

export type NotificationTarget =
  | {
      view: "chat";
      sessionId: string;
    }
  | {
      view: "app";
      appId: string;
    }
  | {
      view: "artifact";
      artifactId: string;
    }
  | {
      view: "crons";
      /** Optional — focus a specific cron job in the crons view. */
      jobId?: string;
    }
  | {
      view: "home";
    };

export type NotificationRecord = {
  id: string;
  kind: string;
  title: string;
  message: string;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  dedupeKey?: string;
  target: NotificationTarget;
  source?: {
    agentId?: string;
    sessionKey?: string;
    appId?: string;
    artifactId?: string;
    cronId?: string;
  };
  metadata?: Record<string, unknown>;
};

/**
 * Drop notifications we don't care to surface in the inbox. We currently
 * surface only cron notifications (the only kind the server emits today);
 * read history is preserved so users can scroll back through past runs.
 */
export function shouldSurfaceNotification(notification: Pick<NotificationRecord, "kind">): boolean {
  return notification.kind.startsWith("cron_");
}

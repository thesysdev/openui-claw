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

import fs from "node:fs/promises";
import path from "node:path";
import { generateSecureUuid } from "openclaw/plugin-sdk/core";

const MAX_NOTIFICATIONS = 400;

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

export type StoredNotification = {
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

export class NotificationStore {
  private dir: string;
  private filePath: string;

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "plugins", "openui-claw", "notifications");
    this.filePath = path.join(this.dir, "notifications.json");
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private async readAll(): Promise<StoredNotification[]> {
    await this.ensureDir();

    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as StoredNotification[];
    } catch {
      return [];
    }
  }

  private async writeAll(items: StoredNotification[]): Promise<void> {
    await this.ensureDir();
    const trimmed = items
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_NOTIFICATIONS);
    await fs.writeFile(this.filePath, JSON.stringify(trimmed, null, 2), "utf-8");
  }

  async list(): Promise<StoredNotification[]> {
    const items = await this.readAll();
    return items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create(
    input: Omit<StoredNotification, "id" | "createdAt" | "updatedAt" | "unread" | "readAt">,
  ): Promise<StoredNotification> {
    const items = await this.readAll();
    const now = new Date().toISOString();
    const record: StoredNotification = {
      id: generateSecureUuid(),
      ...input,
      unread: true,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };

    items.unshift(record);
    await this.writeAll(items);
    return record;
  }

  async upsert(
    input: Omit<StoredNotification, "id" | "createdAt" | "updatedAt" | "unread" | "readAt">,
  ): Promise<StoredNotification> {
    if (!input.dedupeKey) {
      return this.create(input);
    }

    const items = await this.readAll();
    const now = new Date().toISOString();
    const index = items.findIndex((item) => item.dedupeKey === input.dedupeKey);

    if (index === -1) {
      const record: StoredNotification = {
        id: generateSecureUuid(),
        ...input,
        unread: true,
        readAt: null,
        createdAt: now,
        updatedAt: now,
      };
      items.unshift(record);
      await this.writeAll(items);
      return record;
    }

    const existing = items[index]!;
    const updated: StoredNotification = {
      ...existing,
      ...input,
      unread: true,
      readAt: null,
      updatedAt: now,
    };
    items[index] = updated;
    await this.writeAll(items);
    return updated;
  }

  async markRead(ids?: string[]): Promise<number> {
    const items = await this.readAll();
    const idSet = ids && ids.length > 0 ? new Set(ids) : null;
    const now = new Date().toISOString();
    let changed = 0;

    const updated = items.map((item) => {
      const shouldMark = idSet ? idSet.has(item.id) : item.unread;
      if (!shouldMark || !item.unread) return item;
      changed += 1;
      return {
        ...item,
        unread: false,
        readAt: now,
        updatedAt: now,
      };
    });

    if (changed > 0) {
      await this.writeAll(updated);
    }

    return changed;
  }
}

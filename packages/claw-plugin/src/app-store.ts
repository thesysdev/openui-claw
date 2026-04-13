import fs from "node:fs/promises";
import path from "node:path";
import { generateSecureUuid } from "openclaw/plugin-sdk/core";

export type StoredApp = {
  id: string;
  title: string;
  /** OpenUI Lang markup — the live app content rendered by the Renderer. */
  content: string;
  /** Session key of the sub-agent used to generate/update this app. */
  sessionKey: string;
  /** agentId that owns the generation session. */
  agentId: string;
  createdAt: string;
  updatedAt: string;
};

export class AppStore {
  private dir: string;

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "plugins", "openui-claw", "apps");
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async create(data: Omit<StoredApp, "id" | "createdAt" | "updatedAt">): Promise<StoredApp> {
    await this.ensureDir();
    const now = new Date().toISOString();
    const record: StoredApp = {
      id: generateSecureUuid(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(this.filePath(record.id), JSON.stringify(record, null, 2), "utf-8");
    return record;
  }

  async update(
    id: string,
    patch: Partial<Pick<StoredApp, "title" | "content">>,
  ): Promise<StoredApp> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`App not found: ${id}`);
    const updated: StoredApp = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.filePath(id), JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }

  async list(): Promise<StoredApp[]> {
    await this.ensureDir();
    let entries: string[];
    try {
      entries = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const jsonFiles = entries.filter((e) => e.endsWith(".json"));
    const records = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(this.dir, file), "utf-8");
          return JSON.parse(raw) as StoredApp;
        } catch {
          return null;
        }
      }),
    );
    return (records.filter(Boolean) as StoredApp[]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async get(id: string): Promise<StoredApp | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(raw) as StoredApp;
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(id));
    } catch {
      // Already gone — treat as success.
    }
  }
}

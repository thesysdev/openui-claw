import fs from "node:fs/promises";
import path from "node:path";
import { generateSecureUuid } from "openclaw/plugin-sdk/core";

export type StoredArtifact = {
  id: string;
  kind: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  /** Internal source ref — agentId + full sessionKey from the tool context. */
  source: { agentId: string; sessionKey: string };
  createdAt: string;
  updatedAt: string;
};

export class ArtifactStore {
  private dir: string;

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "plugins", "openui-claw", "artifacts");
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async create(
    data: Omit<StoredArtifact, "id" | "createdAt" | "updatedAt">,
  ): Promise<StoredArtifact> {
    await this.ensureDir();
    const now = new Date().toISOString();
    const record: StoredArtifact = {
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
    patch: Partial<Pick<StoredArtifact, "title" | "content" | "metadata">>,
  ): Promise<StoredArtifact> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Artifact not found: ${id}`);
    const updated: StoredArtifact = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(this.filePath(id), JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }

  async list(kind?: string): Promise<StoredArtifact[]> {
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
          return JSON.parse(raw) as StoredArtifact;
        } catch {
          return null;
        }
      }),
    );
    const all = (records.filter(Boolean) as StoredArtifact[]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return kind ? all.filter((a) => a.kind === kind) : all;
  }

  async get(id: string): Promise<StoredArtifact | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(raw) as StoredArtifact;
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

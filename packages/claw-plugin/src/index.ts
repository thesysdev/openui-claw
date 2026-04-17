import { definePluginEntry, emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import type {
  PluginHookBeforePromptBuildEvent,
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
  OpenClawPluginToolContext,
  GatewayRequestHandlerOptions,
} from "openclaw/plugin-sdk/core";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { jsonResult } = require("openclaw/plugin-sdk/core") as any;
import { SYSTEM_PROMPT } from "./generated/system-prompt";
import { ArtifactStore } from "./artifact-store";
import { AppStore } from "./app-store";
import { NotificationStore } from "./notification-store";

// ── mergeStatements — currently simple append, smart merge TODO ──────────

export default definePluginEntry({
  id: "openui-claw-plugin",
  name: "Claw — OpenUI for OpenClaw",
  description:
    "Injects the OpenUI Lang system prompt for requests originating from the Claw client, enabling Generative UI responses instead of plain markdown.",
  configSchema: emptyPluginConfigSchema,

  register(api) {
    api.logger.info(
      "[openui-claw-plugin] register() called — plugin loaded OK",
    );

    // ── System prompt injection ──────────────────────────────────────────────
    api.on(
      "before_prompt_build",
      (
        _event: PluginHookBeforePromptBuildEvent,
        ctx: PluginHookAgentContext,
      ): PluginHookBeforePromptBuildResult | void => {
        if (!ctx.sessionKey?.endsWith(":openui-claw")) {
          return;
        }
        api.logger.info(
          `[openui-claw-plugin] injecting OpenUI system prompt for session: ${ctx.sessionKey}`,
        );
        return { prependSystemContext: SYSTEM_PROMPT };
      },
    );

    // ── Artifact store — lazy-initialized on first use ──────────────────────
    let store: ArtifactStore | null = null;
    const getStore = (): ArtifactStore => {
      if (!store) {
        const stateDir = api.runtime.state.resolveStateDir();
        api.logger.info(
          `[openui-claw-plugin] initialising ArtifactStore at: ${stateDir}`,
        );
        store = new ArtifactStore(stateDir);
      }
      return store;
    };

    // ── App store — lazy-initialized on first use ────────────────────────────
    let appStore: AppStore | null = null;
    const getAppStore = (): AppStore => {
      if (!appStore) {
        const stateDir = api.runtime.state.resolveStateDir();
        appStore = new AppStore(stateDir);
      }
      return appStore;
    };

    // ── Notification store — wrapper-owned inbox ─────────────────────────────
    let notificationStore: NotificationStore | null = null;
    const getNotificationStore = (): NotificationStore => {
      if (!notificationStore) {
        const stateDir = api.runtime.state.resolveStateDir();
        notificationStore = new NotificationStore(stateDir);
      }
      return notificationStore;
    };

    const createNotification = async (
      input: Parameters<NotificationStore["create"]>[0],
    ): Promise<void> => {
      try {
        await getNotificationStore().create(input);
      } catch (error) {
        api.logger.error(
          `[openui-claw-plugin] failed to create notification: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    };

    // ── Artifact tools ──────────────────────────────────────────────────────

    api.logger.info("[openui-claw-plugin] registering tools…");

    api.registerTool((ctx: OpenClawPluginToolContext) => ({
      name: "create_markdown_artifact",
      label: "Create Markdown Artifact",
      description:
        "Create a durable markdown document artifact that the user can view and revisit in the Artifacts panel. Use for reports, summaries, plans, reference material, or any structured text worth preserving.",
      parameters: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Short, descriptive title for the artifact" },
          content: { type: "string", description: "Full markdown content of the document" },
        },
        required: ["title", "content"],
      },
      execute: async (_id: string, params: { title: string; content: string }) => {
        const artifact = await getStore().create({
          kind: "markdown",
          title: params.title,
          content: params.content,
          source: {
            agentId: ctx.agentId ?? "unknown",
            sessionKey: ctx.sessionKey ?? "unknown",
          },
        });
        return jsonResult({ id: artifact.id, title: artifact.title, createdAt: artifact.createdAt });
      },
    }));

    api.registerTool((_ctx: OpenClawPluginToolContext) => ({
      name: "update_markdown_artifact",
      label: "Update Markdown Artifact",
      description:
        "Update the title and/or content of an existing markdown artifact by its id. Call get_artifact first if you need to read the current content before editing.",
      parameters: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "The artifact id" },
          title: { type: "string", description: "New title (optional — omit to keep current)" },
          content: { type: "string", description: "New markdown content (optional — omit to keep current)" },
        },
        required: ["id"],
      },
      execute: async (_id: string, params: { id: string; title?: string; content?: string }) => {
        const artifact = await getStore().update(params.id, {
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.content !== undefined ? { content: params.content } : {}),
        });
        return jsonResult({ id: artifact.id, updatedAt: artifact.updatedAt });
      },
    }));

    api.registerTool(() => ({
      name: "get_artifact",
      label: "Get Artifact By Id",
      description: "Fetch the full content of an artifact by id.",
      parameters: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "The artifact id" },
        },
        required: ["id"],
      },
      execute: async (_id: string, params: { id: string }) => {
        const artifact = await getStore().get(params.id);
        if (!artifact) return jsonResult({ error: "Artifact not found", id: params.id });
        return jsonResult({ id: artifact.id, kind: artifact.kind, title: artifact.title, content: artifact.content });
      },
    }));

    api.registerTool(() => ({
      name: "list_artifacts",
      label: "List Artifacts",
      description: "List existing artifacts, optionally filtered by kind.",
      parameters: {
        type: "object" as const,
        properties: {
          kind: { type: "string", description: "Filter by kind (e.g. 'markdown'). Omit to list all." },
        },
      },
      execute: async (_id: string, params: { kind?: string }) => {
        const items = await getStore().list(typeof params.kind === "string" ? params.kind : undefined);
        return jsonResult(items.map((a) => ({
          id: a.id, kind: a.kind, title: a.title, createdAt: a.createdAt, updatedAt: a.updatedAt,
        })));
      },
    }));

    // ── App tools — direct storage, no subagent ─────────────────────────────

    api.registerTool((ctx: OpenClawPluginToolContext) => ({
      name: "app_create",
      label: "Create App",
      description:
        "Create a live interactive app. Pass the complete openui-lang code. The app is stored and rendered in the Apps panel. Use when the user asks to build a dashboard, app, or interactive view.",
      parameters: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Short display title for the app" },
          code: { type: "string", description: "Complete openui-lang source code for the app" },
        },
        required: ["title", "code"],
      },
      execute: async (_callId: string, params: { title: string; code: string }) => {
        api.logger.info(
          `[openui-claw-plugin] app_create: title="${params.title}" code=${params.code.length} chars`,
        );
        const app = await getAppStore().create({
          title: params.title,
          content: params.code,
          agentId: ctx.agentId ?? "main",
          sessionKey: ctx.sessionKey ?? "",
        });
        api.logger.info(`[openui-claw-plugin] app_create → saved app ${app.id}`);
        return jsonResult({ id: app.id, title: app.title });
      },
    }));

    api.registerTool(() => ({
      name: "get_app",
      label: "Get App",
      description:
        "Fetch the current openui-lang code of an app by id. Call this before app_update to see the current state.",
      parameters: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "The app id" },
        },
        required: ["id"],
      },
      execute: async (_callId: string, params: { id: string }) => {
        const app = await getAppStore().get(params.id);
        if (!app) return jsonResult({ error: "App not found", id: params.id });
        return jsonResult({ id: app.id, title: app.title, content: app.content });
      },
    }));

    api.registerTool(() => ({
      name: "app_update",
      label: "Update App",
      description:
        "Apply an incremental edit patch to an existing app. Pass ONLY changed/new openui-lang statements — the runtime merges by statement name. Call get_app first to see the current code.",
      parameters: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "The app id" },
          patch: { type: "string", description: "openui-lang statements to merge (changed/new only)" },
        },
        required: ["id", "patch"],
      },
      execute: async (_callId: string, params: { id: string; patch: string }) => {
        const existing = await getAppStore().get(params.id);
        if (!existing) return jsonResult({ error: "App not found", id: params.id });

        api.logger.info(
          `[openui-claw-plugin] app_update: id=${params.id} patch=${params.patch.length} chars`,
        );

        // Simple append — prepend existing code with patch on a new line.
        // TODO: restore smart mergeStatements once edge cases are ironed out.
        const merged = existing.content.trimEnd() + "\n" + params.patch.trim();

        const updated = await getAppStore().update(params.id, { content: merged });
        api.logger.info(`[openui-claw-plugin] app_update → updated app ${updated.id}`);
        return jsonResult({ id: updated.id, updatedAt: updated.updatedAt });
      },
    }));

    api.logger.info("[openui-claw-plugin] all tools registered");

    // ── Gateway RPC methods — client reads/writes ───────────────────────────

    api.registerGatewayMethod(
      "artifacts.list",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const kind = typeof params.kind === "string" ? params.kind : undefined;
          const items = await getStore().list(kind);
          respond(true, {
            artifacts: items.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              source: { engineId: "openclaw", agentId: a.source.agentId, sessionId: a.source.sessionKey },
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to list artifacts",
            code: "artifacts.list_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "artifacts.get",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          const artifact = await getStore().get(id);
          respond(true, {
            artifact: artifact
              ? { ...artifact, source: { engineId: "openclaw", agentId: artifact.source.agentId, sessionId: artifact.source.sessionKey } }
              : null,
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to get artifact",
            code: "artifacts.get_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "artifacts.delete",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          await getStore().delete(id);
          respond(true, { deleted: id });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to delete artifact",
            code: "artifacts.delete_failed",
          });
        }
      },
    );

    // ── App gateway RPC methods ──────────────────────────────────────────────

    api.registerGatewayMethod(
      "apps.list",
      async ({ respond }: GatewayRequestHandlerOptions) => {
        try {
          const apps = await getAppStore().list();
          respond(true, {
            apps: apps.map((a) => ({
              id: a.id,
              title: a.title,
              agentId: a.agentId,
              sessionKey: a.sessionKey,
              createdAt: a.createdAt, updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, { message: e instanceof Error ? e.message : "Failed to list apps", code: "apps.list_failed" });
        }
      },
    );

    api.registerGatewayMethod(
      "apps.get",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          const app = await getAppStore().get(id);
          respond(true, { app });
        } catch (e) {
          respond(false, undefined, { message: e instanceof Error ? e.message : "Failed to get app", code: "apps.get_failed" });
        }
      },
    );

    api.registerGatewayMethod(
      "apps.delete",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          await getAppStore().delete(id);
          respond(true, { deleted: id });
        } catch (e) {
          respond(false, undefined, { message: e instanceof Error ? e.message : "Failed to delete app", code: "apps.delete_failed" });
        }
      },
    );

    api.registerGatewayMethod(
      "apps.versions",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          const app = await getAppStore().get(id);
          if (!app) { respond(false, undefined, { message: "App not found", code: "apps.versions_not_found" }); return; }
          respond(true, {
            versions: (app.versions ?? []).map((v, i) => ({
              index: i, timestamp: v.timestamp, source: v.source,
            })),
          });
        } catch (e) {
          respond(false, undefined, { message: e instanceof Error ? e.message : "Failed", code: "apps.versions_failed" });
        }
      },
    );

    api.registerGatewayMethod(
      "apps.restore",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const id = typeof params.id === "string" ? params.id : "";
          const idx = typeof params.versionIndex === "number" ? params.versionIndex : -1;
          const app = await getAppStore().restore(id, idx);
          respond(true, { id: app.id, updatedAt: app.updatedAt });
        } catch (e) {
          respond(false, undefined, { message: e instanceof Error ? e.message : "Failed", code: "apps.restore_failed" });
        }
      },
    );

    api.registerGatewayMethod(
      "notifications.list",
      async ({ respond }: GatewayRequestHandlerOptions) => {
        try {
          const notifications = await getNotificationStore().list();
          respond(true, { notifications });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to list notifications",
            code: "notifications.list_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "notifications.read",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const ids = Array.isArray(params.ids)
            ? params.ids.filter(
                (value: unknown): value is string => typeof value === "string",
              )
            : undefined;
          const updated = await getNotificationStore().markRead(ids);
          respond(true, { updated });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to update notifications",
            code: "notifications.read_failed",
          });
        }
      },
    );

    api.registerGatewayMethod(
      "notifications.upsert",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          if (
            !params ||
            typeof params !== "object" ||
            Array.isArray(params) ||
            typeof params.kind !== "string" ||
            typeof params.title !== "string" ||
            typeof params.message !== "string" ||
            !params.target ||
            typeof params.target !== "object" ||
            Array.isArray(params.target)
          ) {
            respond(false, undefined, {
              message: "Invalid notification payload",
              code: "notifications.upsert_invalid",
            });
            return;
          }

          const notification = await getNotificationStore().upsert({
            kind: params.kind,
            title: params.title,
            message: params.message,
            target: params.target as Parameters<NotificationStore["upsert"]>[0]["target"],
            ...(typeof params.dedupeKey === "string"
              ? { dedupeKey: params.dedupeKey }
              : {}),
            ...(params.source &&
            typeof params.source === "object" &&
            !Array.isArray(params.source)
              ? { source: params.source as Parameters<NotificationStore["upsert"]>[0]["source"] }
              : {}),
            ...(params.metadata &&
            typeof params.metadata === "object" &&
            !Array.isArray(params.metadata)
              ? { metadata: params.metadata as Record<string, unknown> }
              : {}),
          });
          respond(true, { notification });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to upsert notification",
            code: "notifications.upsert_failed",
          });
        }
      },
    );

    // ── tools.invoke — execute tools for rendered apps ──────────────────────
    // Called by the Renderer's toolProvider in AppDetail (Query/Mutation).
    // exec/read are handled directly. Other tools are not yet proxied.

    const invokeExecTool = async (
      args: Record<string, unknown>,
    ): Promise<unknown> => {
      const command = typeof args.command === "string" ? args.command : "";
      if (!command) throw new Error("exec requires a 'command' argument");
      const timeoutMs = typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;
      api.logger.info(
        `[openui-claw-plugin] invokeTool(exec): command=${command.slice(0, 120)}`,
      );
      try {
        const result = await api.runtime.system.runCommandWithTimeout(
          ["sh", "-c", command],
          { timeoutMs, cwd: api.runtime.state.resolveStateDir() },
        );
        const stdout = (result.stdout ?? "").trim();
        const stderr = (result.stderr ?? "").trim();
        const exitCode = result.code ?? 0;

        // Auto-parse stdout as JSON so apps get clean data objects.
        if (exitCode === 0 && stdout) {
          try {
            return JSON.parse(stdout);
          } catch {
            // Not valid JSON — return raw output.
          }
        }
        return { stdout, stderr, exitCode };
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
        return {
          stdout: (e.stdout ?? "").trim(),
          stderr: (e.stderr ?? e.message ?? "").trim(),
          exitCode: e.status ?? 1,
        };
      }
    };

    const invokeReadTool = async (
      args: Record<string, unknown>,
    ): Promise<unknown> => {
      const filePath = typeof args.file_path === "string" ? args.file_path : "";
      if (!filePath) throw new Error("read requires a 'file_path' argument");
      api.logger.info(
        `[openui-claw-plugin] invokeTool(read): path=${filePath}`,
      );
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(filePath, "utf-8");
      return { content };
    };

    const invokeTool = async (
      toolName: string,
      toolArgs: Record<string, unknown>,
      _sessionKey: string,
    ): Promise<unknown> => {
      switch (toolName) {
        case "exec":
        case "bash":
        case "shell":
          return invokeExecTool(toolArgs);
        case "read":
          return invokeReadTool(toolArgs);
        default:
          throw new Error(`Tool "${toolName}" is not available in app runtime. Only exec and read are currently supported.`);
      }
    };

    api.registerGatewayMethod(
      "tools.invoke",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const toolName = typeof params.tool_name === "string" ? params.tool_name : "";
        const toolArgs =
          params.tool_args != null && typeof params.tool_args === "object" && !Array.isArray(params.tool_args)
            ? (params.tool_args as Record<string, unknown>)
            : {};
        const sessionKey = typeof params.sessionKey === "string" ? params.sessionKey : "";

        if (!toolName) {
          respond(false, undefined, { message: "tools.invoke requires a tool name", code: "tools.invoke_missing_tool" });
          return;
        }

        try {
          api.logger.info(`[openui-claw-plugin] tools.invoke: tool=${toolName}`);
          const result = await invokeTool(toolName, toolArgs, sessionKey);
          respond(true, { result });
        } catch (e) {
          api.logger.error(
            `[openui-claw-plugin] tools.invoke failed: tool=${toolName} error=${e instanceof Error ? e.message : String(e)}`,
          );
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Tool invocation failed",
            code: "tools.invoke_failed",
          });
        }
      },
    );

    api.logger.info("[openui-claw-plugin] gateway RPC methods registered");
  },
});

import { definePluginEntry, emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import type {
  PluginHookBeforePromptBuildEvent,
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
  OpenClawPluginToolContext,
  GatewayRequestHandlerOptions,
} from "openclaw/plugin-sdk/core";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { generateSecureUuid, jsonResult } = require("openclaw/plugin-sdk/core") as any;
import { SYSTEM_PROMPT } from "./generated/system-prompt";
import { APP_SYSTEM_PROMPT } from "./generated/app-system-prompt";
import { ArtifactStore } from "./artifact-store";
import { AppStore } from "./app-store";

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
        // The Claw client appends ":openui-claw" to session keys (e.g. "agent:main:main:openui-claw").
        // This is the only reliable detection mechanism since client.id is not exposed
        // in the before_prompt_build hook context.
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

    // ── Helpers ──────────────────────────────────────────────────────────────
    // Session key suffix used by the app-gen sub-agent.
    const isAppGenSession = (ctx: OpenClawPluginToolContext) =>
      ctx.sessionKey?.endsWith(":openui-claw-app") ?? false;

    // Stored session messages use the LLM wire format:
    //   content is either a plain string OR an array of content blocks.
    type ContentBlock = { type: string; text?: string };
    type SessionMessage = { role: string; content: string | ContentBlock[] };

    /** Extract the final text from an assistant message's content field. */
    function extractAssistantText(msg: SessionMessage): string {
      if (typeof msg.content === "string") return msg.content;
      const textBlocks = msg.content.filter(
        (b) => b.type === "text" && typeof b.text === "string",
      );
      const last = textBlocks[textBlocks.length - 1];
      return last?.text ?? "";
    }

    /** Pull the last assistant message from a session messages array and return its text. */
    function resolveGeneratedContent(
      messages: unknown[],
      label: string,
      fallback: string,
    ): string {
      api.logger.info(
        `[openui-claw-plugin] ${label}: ${messages.length} messages returned`,
      );
      for (const m of messages) {
        const msg = m as SessionMessage;
        const isArray = Array.isArray(msg.content);
        api.logger.info(
          `[openui-claw-plugin] ${label}: role=${msg.role} content=${isArray ? `array[${(msg.content as ContentBlock[]).length}]` : `string(${String(msg.content).length})`}`,
        );
      }
      const lastAssistant = [...messages]
        .reverse()
        .map((m) => m as SessionMessage)
        .find((m) => m.role === "assistant" && m.content);
      if (!lastAssistant) {
        api.logger.info(
          `[openui-claw-plugin] ${label}: no assistant message found — using fallback`,
        );
        return fallback;
      }
      const text = extractAssistantText(lastAssistant);
      api.logger.info(
        `[openui-claw-plugin] ${label}: extracted ${text.length} chars — preview: ${text.slice(0, 120)}`,
      );
      return text;
    }

    // ── Agent tools ──────────────────────────────────────────────────────────

    api.logger.info("[openui-claw-plugin] registering tools…");

    // create_markdown_artifact — suppressed for app-gen sessions
    api.registerTool((ctx: OpenClawPluginToolContext) => {
      if (isAppGenSession(ctx)) return null;
      api.logger.info(
        `[openui-claw-plugin] create_markdown_artifact factory invoked (agentId=${ctx.agentId ?? "?"}, sessionKey=${ctx.sessionKey ?? "?"})`,
      );
      const desc =
        "Create a durable markdown document artifact that the user can view and revisit in the Artifacts panel. Use for reports, summaries, plans, reference material, or any structured text worth preserving.";
      const exec = async (params: Record<string, unknown>) => {
        const artifact = await getStore().create({
          kind: "markdown",
          title: String(params.title ?? ""),
          content: String(params.content ?? ""),
          source: {
            agentId: ctx.agentId ?? "unknown",
            sessionKey: ctx.sessionKey ?? "unknown",
          },
        });
        return { id: artifact.id, createdAt: artifact.createdAt };
      };
      return {
        name: "create_markdown_artifact",
        label: "Create Markdown Artifact",
        description: desc,
        parameters: {
          type: "object" as const,
          properties: {
            title: {
              type: "string",
              description: "Short, descriptive title for the artifact",
            },
            content: {
              type: "string",
              description: "Full markdown content of the document",
            },
          },
          required: ["title", "content"],
        },
        execute: async (
          _id: string,
          params: { title: string; content: string },
        ) => {
          return jsonResult(await exec(params as Record<string, unknown>));
        },
      };
    });

    (() => {
      const desc =
        "Update the title and/or content of an existing markdown artifact by its id. Call get_artifact first if you need to read the current content before editing.";
      const exec = async (params: Record<string, unknown>) => {
        const artifact = await getStore().update(String(params.id ?? ""), {
          ...(params.title !== undefined
            ? { title: String(params.title) }
            : {}),
          ...(params.content !== undefined
            ? { content: String(params.content) }
            : {}),
        });
        return { id: artifact.id, updatedAt: artifact.updatedAt };
      };
      api.registerTool((ctx: OpenClawPluginToolContext) => {
        if (isAppGenSession(ctx)) return null;
        return {
          name: "update_markdown_artifact",
          label: "Update Markdown Artifact",
          description: desc,
          parameters: {
            type: "object" as const,
            properties: {
              id: {
                type: "string",
                description:
                  "The artifact id returned by create_markdown_artifact",
              },
              title: {
                type: "string",
                description:
                  "New title (optional — omit to keep current title)",
              },
              content: {
                type: "string",
                description:
                  "New markdown content (optional — omit to keep current content)",
              },
            },
            required: ["id"],
          },
          execute: async (
            _id: string,
            params: { id: string; title?: string; content?: string },
          ) => {
            return jsonResult(await exec(params as Record<string, unknown>));
          },
        };
      });
    })();

    (() => {
      const desc =
        "Fetch the full content of an artifact by id. Use this before updating an artifact you did not create in the current session.";
      const exec = async (params: Record<string, unknown>) => {
        const artifact = await getStore().get(String(params.id ?? ""));
        if (!artifact) return { error: "Artifact not found", id: params.id };
        return artifact;
      };
      api.registerTool((ctx: OpenClawPluginToolContext) => {
        if (isAppGenSession(ctx)) return null;
        return {
          name: "get_artifact",
          label: "Get Artifact By Id",
          description: desc,
          parameters: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "The artifact id" },
            },
            required: ["id"],
          },
          execute: async (_id: string, params: { id: string }) => {
            return jsonResult(await exec(params as Record<string, unknown>));
          },
        };
      });
    })();

    (() => {
      const desc =
        "List existing artifacts, optionally filtered by kind. Returns id, kind, title, source, and timestamps for each.";
      const exec = async (params: Record<string, unknown>) => {
        const kind = typeof params.kind === "string" ? params.kind : undefined;
        const items = await getStore().list(kind);
        return items.map((a) => ({
          id: a.id,
          kind: a.kind,
          title: a.title,
          source: a.source,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        }));
      };
      api.registerTool((ctx: OpenClawPluginToolContext) => {
        if (isAppGenSession(ctx)) return null;
        return {
          name: "list_artifacts",
          label: "List Artifacts",
          description: desc,
          parameters: {
            type: "object" as const,
            properties: {
              kind: {
                type: "string",
                description:
                  "Filter by kind (e.g. 'markdown'). Omit to list all.",
              },
            },
          },
          execute: async (_id: string, params: { kind?: string }) => {
            return jsonResult(await exec(params as Record<string, unknown>));
          },
        };
      });
    })();

    // ── App tools — app_create and app_update (suppressed for app-gen sessions) ─

    api.registerTool((ctx: OpenClawPluginToolContext) => {
      if (isAppGenSession(ctx)) return null;
      const agentId = ctx.agentId ?? "main";
      return {
        name: "app_create",
        label: "Create App",
        description:
          "Create a live interactive app from a user request. The app is rendered in the Apps panel and can query live data via tools. Use when the user asks to build a dashboard, app, or interactive view.",
        parameters: {
          type: "object" as const,
          properties: {
            title: {
              type: "string",
              description: "Short display title for the app",
            },
            prompt: {
              type: "string",
              description:
                "Full description of what the app should do and display",
            },
          },
          required: ["title", "prompt"],
        },
        execute: async (
          callId: string,
          params: { title: string; prompt: string },
        ) => {
          const appId = generateSecureUuid();
          const sessionKey = `agent:${agentId}:${appId}:openui-claw-app`;

          api.logger.info(
            `[openui-claw-plugin] app_create called: title="${params.title}" sessionKey=${sessionKey} callId=${callId}`,
          );

          const { runId } = await api.runtime.subagent.run({
            sessionKey,
            message: params.prompt,
            extraSystemPrompt: APP_SYSTEM_PROMPT,
            deliver: false,
            idempotencyKey: callId,
          });

          api.logger.info(
            `[openui-claw-plugin] app_create: sub-agent run started runId=${runId}`,
          );

          const result = await api.runtime.subagent.waitForRun({
            runId,
            timeoutMs: 600_000,
          });

          api.logger.info(
            `[openui-claw-plugin] app_create: sub-agent run finished status=${result.status} runId=${runId}${result.error ? ` error=${result.error}` : ""}`,
          );

          if (result.status !== "ok") {
            api.logger.error(
              `[openui-claw-plugin] app_create: sub-agent failed: ${result.error ?? "unknown error"}`,
            );
            return jsonResult({
              error: result.error ?? "App generation failed",
            });
          }

          const { messages } = await api.runtime.subagent.getSessionMessages({
            sessionKey,
            limit: 10,
          });
          api.logger.info(
            `[openui-claw-plugin] app_create: fetched ${messages.length} messages from session`,
          );

          const content = resolveGeneratedContent(messages, "app_create", "");
          api.logger.info(
            `[openui-claw-plugin] app_create: resolved content length=${content.length}`,
          );

          const app = await getAppStore().create({
            title: params.title,
            content,
            agentId,
            sessionKey,
          });
          api.logger.info(
            `[openui-claw-plugin] app_create → saved app ${app.id}`,
          );
          return jsonResult({ id: app.id, title: app.title });
        },
      };
    });

    api.registerTool((ctx: OpenClawPluginToolContext) => {
      if (isAppGenSession(ctx)) return null;
      return {
        name: "app_update",
        label: "Update App",
        description:
          "Update an existing live app by id. Continues the same generation session so the model has full context of the original app.",
        parameters: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "The app id returned by app_create",
            },
            prompt: {
              type: "string",
              description: "Description of what to change or add",
            },
          },
          required: ["id", "prompt"],
        },
        execute: async (
          callId: string,
          params: { id: string; prompt: string },
        ) => {
          api.logger.info(
            `[openui-claw-plugin] app_update called: id=${params.id} callId=${callId}`,
          );

          const existing = await getAppStore().get(params.id);
          if (!existing) {
            api.logger.error(
              `[openui-claw-plugin] app_update: app not found id=${params.id}`,
            );
            return jsonResult({ error: "App not found", id: params.id });
          }

          api.logger.info(
            `[openui-claw-plugin] app_update: found app "${existing.title}" sessionKey=${existing.sessionKey}`,
          );

          const { runId } = await api.runtime.subagent.run({
            sessionKey: existing.sessionKey,
            message: params.prompt,
            deliver: false,
            idempotencyKey: callId,
          });

          api.logger.info(
            `[openui-claw-plugin] app_update: sub-agent run started runId=${runId}`,
          );

          const result = await api.runtime.subagent.waitForRun({
            runId,
            timeoutMs: 600_000,
          });

          api.logger.info(
            `[openui-claw-plugin] app_update: sub-agent run finished status=${result.status} runId=${runId}${result.error ? ` error=${result.error}` : ""}`,
          );

          if (result.status !== "ok") {
            api.logger.error(
              `[openui-claw-plugin] app_update: sub-agent failed: ${result.error ?? "unknown error"}`,
            );
            return jsonResult({ error: result.error ?? "App update failed" });
          }

          const { messages } = await api.runtime.subagent.getSessionMessages({
            sessionKey: existing.sessionKey,
            limit: 10,
          });
          api.logger.info(
            `[openui-claw-plugin] app_update: fetched ${messages.length} messages from session`,
          );

          const content = resolveGeneratedContent(
            messages,
            "app_update",
            existing.content,
          );
          api.logger.info(
            `[openui-claw-plugin] app_update: resolved content length=${content.length}`,
          );

          const updated = await getAppStore().update(params.id, { content });
          api.logger.info(
            `[openui-claw-plugin] app_update → updated app ${updated.id}`,
          );
          return jsonResult({ id: updated.id, updatedAt: updated.updatedAt });
        },
      };
    });
    api.logger.info("[openui-claw-plugin] all tools registered");

    // ── Gateway RPC methods — read/delete side for the Claw client ───────────

    api.registerGatewayMethod(
      "artifacts.list",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const kind =
            typeof params.kind === "string" ? params.kind : undefined;
          const items = await getStore().list(kind);
          respond(true, {
            artifacts: items.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              // Map internal source shape to client's SourceRef shape.
              source: {
                engineId: "openclaw",
                agentId: a.source.agentId,
                sessionId: a.source.sessionKey,
              },
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, {
            message:
              e instanceof Error ? e.message : "Failed to list artifacts",
            code: "",
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
              ? {
                  ...artifact,
                  source: {
                    engineId: "openclaw",
                    agentId: artifact.source.agentId,
                    sessionId: artifact.source.sessionKey,
                  },
                }
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
            message:
              e instanceof Error ? e.message : "Failed to delete artifact",
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
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            })),
          });
        } catch (e) {
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to list apps",
            code: "apps.list_failed",
          });
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
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to get app",
            code: "apps.get_failed",
          });
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
          respond(false, undefined, {
            message: e instanceof Error ? e.message : "Failed to delete app",
            code: "apps.delete_failed",
          });
        }
      },
    );

    // ── tools.invoke — execute any tool for rendered apps ───────────────────
    // Called by the Renderer's toolProvider in AppDetail (Query/Mutation calls).
    //
    // Strategy:
    //  • exec → run directly via api.runtime.system.runCommandWithTimeout
    //    (the gateway's HTTP /tools/invoke endpoint doesn't include exec — it's
    //     only created by createPiTools inside agent sessions)
    //  • read → read files directly via Node.js fs
    //  • everything else → proxy to the gateway HTTP /tools/invoke endpoint
    //    (works for gateway-scoped tools: web_search, web_fetch, message, etc.)


    const invokeExecTool = async (
      args: Record<string, unknown>,
    ): Promise<unknown> => {
      const command = typeof args.command === "string" ? args.command : "";
      if (!command) throw new Error("exec requires a 'command' argument");
      const timeoutMs =
        typeof args.timeout_ms === "number" ? args.timeout_ms : 30_000;
      api.logger.info(
        `[openui-claw-plugin] invokeTool(exec/direct): command=${command.slice(0, 120)}`,
      );
      try {
        const result = await api.runtime.system.runCommandWithTimeout(
          ["sh", "-c", command],
          { timeoutMs, cwd: api.runtime.state.resolveStateDir() },
        );
        return {
          stdout: (result.stdout ?? "").trim(),
          stderr: (result.stderr ?? "").trim(),
          exitCode: result.code ?? 0,
        };
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
        `[openui-claw-plugin] invokeTool(read/direct): path=${filePath}`,
      );
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(filePath, "utf-8");
      return { content };
    };

    // const invokeViaGatewayHttp = async (
    //   toolName: string,
    //   toolArgs: Record<string, unknown>,
    //   sessionKey: string,
    // ): Promise<unknown> => {
    //   const { port, token } = resolveGatewayUrl();
    //   const url = `http://127.0.0.1:${port}/tools/invoke`;
    //   api.logger.info(
    //     `[openui-claw-plugin] invokeTool(http): tool=${toolName} port=${port} sessionKey=${sessionKey || "(default)"}`,
    //   );
    //   const res = await fetch(url, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       ...(token ? { Authorization: `Bearer ${token}` } : {}),
    //       "x-openclaw-sender-is-owner": "true",
    //     },
    //     body: JSON.stringify({
    //       tool: toolName,
    //       args: toolArgs,
    //       sessionKey: sessionKey || undefined,
    //     }),
    //   });
    //   type HttpInvokeResponse = {
    //     ok: boolean;
    //     result?: unknown;
    //     error?: { message?: string; type?: string };
    //   };
    //   const json = (await res.json()) as HttpInvokeResponse;
    //   if (!json.ok) {
    //     throw new Error(
    //       json.error?.message ?? `tool ${toolName} failed (HTTP ${res.status})`,
    //     );
    //   }
    //   return json.result;
    // };

    const invokeTool = async (
      toolName: string,
      toolArgs: Record<string, unknown>,
      sessionKey: string,
    ): Promise<unknown> => {
      switch (toolName) {
        case "exec":
        case "bash":
        case "shell":
          return invokeExecTool(toolArgs);
        case "read":
          return invokeReadTool(toolArgs);
        default:
          // return invokeViaGatewayHttp(toolName, toolArgs, sessionKey);
      }
    };

    api.registerGatewayMethod(
      "tools.invoke",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const toolName = typeof params.tool_name === "string" ? params.tool_name : "";
        const toolArgs =
          params.tool_args != null &&
          typeof params.tool_args === "object" &&
          !Array.isArray(params.tool_args)
            ? (params.tool_args as Record<string, unknown>)
            : {};
        const sessionKey =
          typeof params.sessionKey === "string" ? params.sessionKey : "";

        if (!toolName) {
          respond(false, undefined, {
            message: "tools.invoke requires a tool name",
            code: "tools.invoke_missing_tool",
          });
          return;
        }

        try {
          api.logger.info(
            `[openui-claw-plugin] tools.invoke: tool=${toolName} sessionKey=${sessionKey || "(none)"}`,
          );
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

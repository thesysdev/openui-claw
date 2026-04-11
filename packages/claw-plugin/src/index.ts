import { definePluginEntry, emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import type {
  PluginHookBeforePromptBuildEvent,
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
  OpenClawPluginToolContext,
  GatewayRequestHandlerOptions,
} from "openclaw/plugin-sdk/core";
import { jsonResult } from "openclaw/plugin-sdk/core";
import { SYSTEM_PROMPT } from "./generated/system-prompt";
import { ArtifactStore } from "./artifact-store";

export default definePluginEntry({
  id: "openui-claw-plugin",
  name: "Claw — OpenUI for OpenClaw",
  description:
    "Injects the OpenUI Lang system prompt for requests originating from the Claw client, enabling Generative UI responses instead of plain markdown.",
  configSchema: emptyPluginConfigSchema,

  register(api) {
    api.logger.info("[openui-claw-plugin] register() called — plugin loaded OK");

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
        api.logger.info(`[openui-claw-plugin] injecting OpenUI system prompt for session: ${ctx.sessionKey}`);
        return { prependSystemContext: SYSTEM_PROMPT };
      },
    );

    // ── Artifact store — lazy-initialized on first use ──────────────────────
    let store: ArtifactStore | null = null;
    const getStore = (): ArtifactStore => {
      if (!store) {
        const stateDir = api.runtime.state.resolveStateDir();
        api.logger.info(`[openui-claw-plugin] initialising ArtifactStore at: ${stateDir}`);
        store = new ArtifactStore(stateDir);
      }
      return store;
    };

    // ── Agent tools — one pair per artifact kind ────────────────────────────

    api.logger.info("[openui-claw-plugin] registering tools…");

    // create_markdown_artifact — uses ctx for source provenance
    api.registerTool((ctx: OpenClawPluginToolContext) => {
      api.logger.info(`[openui-claw-plugin] create_markdown_artifact factory invoked (agentId=${ctx.agentId ?? "?"}, sessionKey=${ctx.sessionKey ?? "?"})`);
      return {
        name: "create_markdown_artifact",
        description:
          "Create a durable markdown document artifact that the user can view and revisit in the Artifacts panel. Use for reports, summaries, plans, reference material, or any structured text worth preserving.",
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
          return jsonResult({ id: artifact.id, createdAt: artifact.createdAt });
        },
      };
    });

    api.logger.info("[openui-claw-plugin] registered create_markdown_artifact");

    api.registerTool((_ctx: OpenClawPluginToolContext) => ({
      name: "update_markdown_artifact",
      description:
        "Update the title and/or content of an existing markdown artifact by its id. Call get_artifact first if you need to read the current content before editing.",
      parameters: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "The artifact id returned by create_markdown_artifact",
          },
          title: {
            type: "string",
            description: "New title (optional — omit to keep current title)",
          },
          content: {
            type: "string",
            description: "New markdown content (optional — omit to keep current content)",
          },
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

    api.logger.info("[openui-claw-plugin] registered update_markdown_artifact");

    // ── Shared read tools ────────────────────────────────────────────────────

    api.registerTool((_ctx: OpenClawPluginToolContext) => ({
      name: "get_artifact",
      description:
        "Fetch the full content of an artifact by id. Use this before updating an artifact you did not create in the current session.",
      parameters: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "The artifact id" },
        },
        required: ["id"],
      },
      execute: async (_id: string, params: { id: string }) => {
        const artifact = await getStore().get(params.id);
        if (!artifact) {
          return jsonResult({ error: "Artifact not found", id: params.id });
        }
        return jsonResult(artifact);
      },
    }));

    api.registerTool((_ctx: OpenClawPluginToolContext) => ({
      name: "list_artifacts",
      description:
        "List existing artifacts, optionally filtered by kind. Returns id, kind, title, source, and timestamps for each.",
      parameters: {
        type: "object" as const,
        properties: {
          kind: {
            type: "string",
            description: "Filter by kind (e.g. 'markdown'). Omit to list all.",
          },
        },
      },
      execute: async (_id: string, params: { kind?: string }) => {
        const items = await getStore().list(params.kind);
        return jsonResult(
          items.map((a) => ({
            id: a.id,
            kind: a.kind,
            title: a.title,
            source: a.source,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })),
        );
      },
    }));

    api.logger.info("[openui-claw-plugin] all tools registered");

    // ── Gateway RPC methods — read/delete side for the Claw client ───────────

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
            message: e instanceof Error ? e.message : "Failed to list artifacts",
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
          });
        }
      },
    );

    api.logger.info("[openui-claw-plugin] gateway RPC methods registered");
  },
});

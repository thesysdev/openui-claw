import { definePluginEntry, emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import type {
  PluginHookBeforePromptBuildEvent,
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
} from "openclaw/plugin-sdk/core";
import { openuiChatLibrary, openuiChatPromptOptions } from "@openuidev/react-ui/genui-lib";

// Generated once at module load — jiti executes this when the plugin is loaded.
const SYSTEM_PROMPT = openuiChatLibrary.prompt(openuiChatPromptOptions);

export default definePluginEntry({
  id: "openui-claw",
  name: "Claw — OpenUI for OpenClaw",
  description:
    "Injects the OpenUI Lang system prompt for requests originating from the Claw client, enabling Generative UI responses instead of plain markdown.",
  configSchema: emptyPluginConfigSchema,

  register(api) {
    api.on(
      "before_prompt_build",
      (
        _event: PluginHookBeforePromptBuildEvent,
        ctx: PluginHookAgentContext
      ): PluginHookBeforePromptBuildResult | void => {
        // The Claw client appends ":openui-claw" to session keys (e.g. "main:openui-claw").
        // This is the only reliable detection mechanism since client.id is not exposed
        // in the before_prompt_build hook context.
        if (!ctx.sessionKey?.includes(":openui-claw:") &&
            !ctx.sessionKey?.endsWith(":openui-claw")) {
          return;
        }
        return { prependSystemContext: SYSTEM_PROMPT };
      }
    );
  },
});

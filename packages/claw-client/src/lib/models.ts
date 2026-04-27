// Centralized model name/ref utilities.
// OpenClaw stores model as split fields (model + modelProvider) but
// sessions.patch accepts qualified refs ("provider/model").

import type { ModelChoice } from "@/types/gateway-responses";

/** Build a qualified "provider/model" ref from separate fields. */
export function qualifyModel(model: string, provider: string): string {
  if (!provider) return model;
  return model.startsWith(`${provider}/`) ? model : `${provider}/${model}`;
}

/** Split a qualified "provider/model" ref into separate fields. */
export function splitModelRef(qualified: string): { model: string; modelProvider: string } {
  const idx = qualified.indexOf("/");
  if (idx < 0) return { model: qualified, modelProvider: "" };
  return { modelProvider: qualified.slice(0, idx), model: qualified.slice(idx + 1) };
}

// Priority-ordered patterns for picking a sane "default" model when the user
// hasn't explicitly chosen one. The gateway sorts `models.list` alphabetically
// by provider then name (see openclaw model-catalog.ts), which lands old Haiku
// at index 0 on OpenRouter — useless as a default. We override that with our
// own preference: latest reasoning-tier Claude → top GPT/Gemini → anything
// reasoning-capable → first model. Patterns match against id OR name.
const DEFAULT_MODEL_PATTERNS: RegExp[] = [
  /(claude-)?(opus|sonnet)-4/i,
  /(claude-)?4(\.\d+)?-(opus|sonnet)/i,
  /(claude-)?3[\.-]?7-sonnet/i,
  /(claude-)?3[\.-]?5-sonnet/i,
  /gpt-5/i,
  /gpt-4o/i,
  /gemini-2[\.-]?5-pro/i,
  /gemini-2/i,
  /sonnet/i,
  /opus/i,
];

/**
 * Pick a sensible default from a `models.list` response.
 *
 * Resolution order:
 *   1. If `preferredHint` is provided (qualified `provider/model` ref) and it
 *      matches a model in the list, prefer that. Callers should pass the
 *      most authoritative ref they have — typically agent.model.primary,
 *      falling back to the gateway's `models.list.defaultId`.
 *   2. Otherwise scan our priority patterns (latest reasoning Claudes, then
 *      GPT/Gemini, then any sonnet/opus).
 *   3. Otherwise the first reasoning-capable model.
 *   4. Otherwise the gateway's first model (alphabetical fallback).
 */
export function pickPreferredDefault(
  models: ModelChoice[],
  preferredHint?: string | null,
): ModelChoice | null {
  if (models.length === 0) return null;
  if (preferredHint) {
    // Try several match shapes — refs aren't always provider-qualified the
    // way models.list entries are. For OpenRouter a primary like
    // "openai/gpt-5.4" needs to match a model whose id is "openai/gpt-5.4"
    // with provider "openrouter".
    const exact = models.find(
      (m) =>
        qualifyModel(m.id, m.provider) === preferredHint ||
        m.id === preferredHint ||
        preferredHint.endsWith(`/${m.id}`),
    );
    if (exact) return exact;
    // Hint matched no visible model (allowlist filtered, stale config, etc.) —
    // fall through to heuristics rather than surfacing a hidden id.
  }
  for (const pattern of DEFAULT_MODEL_PATTERNS) {
    const match = models.find((m) => pattern.test(m.id) || pattern.test(m.name));
    if (match) return match;
  }
  const reasoning = models.find((m) => m.reasoning === true);
  if (reasoning) return reasoning;
  return models[0] ?? null;
}

/**
 * Normalize a sessions.patch payload for local state updates.
 * Splits qualified model refs so local sessionMeta matches the shape
 * the server returns (separate model + modelProvider fields).
 */
export function normalizeSessionPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const model = patch.model;
  if (typeof model === "string" && model.includes("/")) {
    const split = splitModelRef(model);
    return { ...patch, model: split.model, modelProvider: split.modelProvider };
  }
  if (model === null) {
    return { ...patch, modelProvider: null };
  }
  return patch;
}

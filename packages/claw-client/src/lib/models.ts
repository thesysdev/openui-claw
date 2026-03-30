// Centralized model name/ref utilities.
// OpenClaw stores model as split fields (model + modelProvider) but
// sessions.patch accepts qualified refs ("provider/model").

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

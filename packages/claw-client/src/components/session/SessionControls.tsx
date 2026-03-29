"use client";

import { useCallback } from "react";
import { Brain, Cpu } from "lucide-react";
import type { ModelChoice, SessionRow } from "@/types/gateway-responses";

const THINKING_LEVELS = [
  { value: "", label: "Default" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
] as const;

interface Props {
  meta: SessionRow | undefined;
  models: ModelChoice[];
  onPatch: (sessionKey: string, patch: Record<string, unknown>) => Promise<boolean>;
  sessionKey: string | null;
}

export function ComposerToolbar({ meta, models, onPatch, sessionKey }: Props) {
  if (!sessionKey) return null;

  const currentThinking = meta?.thinkingLevel ?? "";
  const currentModel = meta?.model ?? "";

  const handleThinkingChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPatch(sessionKey, { thinkingLevel: e.target.value || null });
    },
    [onPatch, sessionKey]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPatch(sessionKey, { model: e.target.value || null });
    },
    [onPatch, sessionKey]
  );

  return (
    <div className="composer-toolbar">
      <div className="composer-toolbar__inner">
        <div className="composer-toolbar__controls">
          <div className="composer-toolbar__select-group">
            <Brain className="composer-toolbar__icon" />
            <select
              value={currentThinking}
              onChange={handleThinkingChange}
              className="composer-toolbar__select"
            >
              {THINKING_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="composer-toolbar__select-group">
            <Cpu className="composer-toolbar__icon" />
            <select
              value={currentModel}
              onChange={handleModelChange}
              className="composer-toolbar__select composer-toolbar__select--model"
            >
              <option value="">Default</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

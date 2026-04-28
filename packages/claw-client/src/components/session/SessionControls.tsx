"use client";

import { useCallback } from "react";
import { Brain, Cpu } from "lucide-react";
import type { ModelChoice, SessionRow } from "@/types/gateway-responses";
import { qualifyModel } from "@/lib/models";
import { THINKING_LEVELS } from "@/lib/thinking-levels";

function formatK(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}

interface Props {
  meta: SessionRow | undefined;
  models: ModelChoice[];
  onPatch: (sessionKey: string, patch: Record<string, unknown>) => Promise<boolean>;
  sessionKey: string | null;
}

export function ComposerToolbar({ meta, models, onPatch, sessionKey }: Props) {
  if (!sessionKey) return null;

  const currentThinking = meta?.thinkingLevel ?? "";
  const thinkingDefault = meta?.thinkingDefault ?? null;
  const thinkingOptions = meta?.thinkingOptions ?? null;

  const currentModelValue = meta?.model
    ? qualifyModel(meta.model, meta.modelProvider ?? "")
    : "";

  const usedTokens = meta?.totalTokens ?? null;
  const contextTokens = meta?.contextTokens ?? null;

  const usagePct = usedTokens !== null && contextTokens
    ? Math.min(100, (usedTokens / contextTokens) * 100)
    : null;

  const usageColor =
    usagePct === null ? "" :
    usagePct >= 90 ? "var(--color-status-error)" :
    usagePct >= 70 ? "var(--color-status-warning)" :
    "var(--color-status-online)";

  const handleThinkingChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPatch(sessionKey, { thinkingLevel: e.target.value || null });
    },
    [onPatch, sessionKey]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextModelId = e.target.value;
      onPatch(sessionKey, { model: nextModelId || null });
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
              {THINKING_LEVELS.filter(
                (t) => t.value === "" || !thinkingOptions || thinkingOptions.includes(t.value),
              ).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value === "" && thinkingDefault
                    ? `Default (${thinkingDefault})`
                    : t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="composer-toolbar__select-group">
            <Cpu className="composer-toolbar__icon" />
            <select
              value={currentModelValue}
              onChange={handleModelChange}
              className="composer-toolbar__select composer-toolbar__select--model"
            >
              <option value="">Default</option>
              {models.map((m) => (
                <option key={qualifyModel(m.id, m.provider)} value={qualifyModel(m.id, m.provider)}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>
        </div>

        {usedTokens !== null && contextTokens !== null && (() => {
          const r = 7;
          const circ = 2 * Math.PI * r;
          const dash = ((usagePct ?? 0) / 100) * circ;
          return (
            <div
              className="composer-toolbar__context-usage"
              title={`${usedTokens.toLocaleString()} / ${contextTokens.toLocaleString()} tokens (${Math.round(usagePct!)}%)`}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" className="composer-toolbar__context-ring">
                <circle cx="9" cy="9" r={r} fill="none" stroke="rgb(var(--color-border-default))" strokeWidth="2" />
                <circle
                  cx="9" cy="9" r={r}
                  fill="none"
                  stroke={usageColor}
                  strokeWidth="2"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="round"
                  transform="rotate(-90 9 9)"
                  style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }}
                />
              </svg>
              <span className="composer-toolbar__context-label">
                {formatK(usedTokens)}/{formatK(contextTokens)}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

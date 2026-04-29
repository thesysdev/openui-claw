"use client";

import { playCompletionChime } from "@/lib/chime";
import {
  setPreferences,
  usePreferences,
  type FontSize,
  type SendKey,
  type ThemeSkin,
} from "@/lib/preferences";
import { useState } from "react";

/**
 * UI for the per-device prefs (lib/preferences.ts).
 *
 * Pure form: each control writes through `setPreferences`, which both
 * persists to localStorage and re-applies the data attributes on
 * `<html>`. There's no submit button — preferences feel snappier when
 * they apply live.
 */

const SEND_KEY_OPTIONS: { value: SendKey; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Touch → ⌘↵, desktop → ↵" },
  { value: "enter", label: "Enter", hint: "↵ sends, Shift+↵ newline" },
  { value: "mod-enter", label: "Cmd / Ctrl + Enter", hint: "↵ newline, ⌘↵ sends" },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Default" },
  { value: "lg", label: "Large" },
];

const SKIN_OPTIONS: { value: ThemeSkin; label: string; swatch: string }[] = [
  { value: "default", label: "Default", swatch: "#6D28D9" },
  { value: "ocean", label: "Ocean", swatch: "#0E7490" },
  { value: "sunset", label: "Sunset", swatch: "#C2410C" },
  { value: "forest", label: "Forest", swatch: "#15803D" },
  { value: "mono", label: "Mono", swatch: "#525252" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-text-neutral-secondary">{label}</label>
      {children}
      {hint ? <p className="text-sm text-text-neutral-tertiary">{hint}</p> : null}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-border-default bg-foreground p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              active
                ? "bg-background text-text-neutral-primary shadow-sm"
                : "text-text-neutral-secondary hover:text-text-neutral-primary"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreferencesPanel() {
  const prefs = usePreferences();
  const [previewedSound, setPreviewedSound] = useState(false);

  const sendKeyHint = SEND_KEY_OPTIONS.find((o) => o.value === prefs.sendKey)?.hint;

  return (
    <div className="flex flex-col gap-5">
      <Field label="Send key" hint={sendKeyHint}>
        <Segmented
          value={prefs.sendKey}
          options={SEND_KEY_OPTIONS.map(({ value, label }) => ({ value, label }))}
          onChange={(sendKey) => setPreferences({ sendKey })}
        />
      </Field>

      <Field
        label="Notification sound"
        hint="Plays a soft chime when the assistant finishes a response while this tab is in the background."
      >
        <div className="flex items-center gap-3">
          <Segmented
            value={prefs.notificationSound ? "on" : "off"}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
            onChange={(v) => setPreferences({ notificationSound: v === "on" })}
          />
          <button
            type="button"
            disabled={!prefs.notificationSound}
            onClick={() => {
              playCompletionChime();
              setPreviewedSound(true);
              setTimeout(() => setPreviewedSound(false), 1200);
            }}
            className="rounded-lg border border-border-default px-3 py-1 text-sm text-text-neutral-secondary transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {previewedSound ? "♪ Played" : "Preview"}
          </button>
        </div>
      </Field>

      <Field label="Font size">
        <Segmented
          value={prefs.fontSize}
          options={FONT_SIZE_OPTIONS}
          onChange={(fontSize) => setPreferences({ fontSize })}
        />
      </Field>

      <Field label="Accent skin" hint="Applied on top of the dark / light base theme.">
        <div className="flex flex-wrap gap-2">
          {SKIN_OPTIONS.map((opt) => {
            const active = opt.value === prefs.themeSkin;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPreferences({ themeSkin: opt.value })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-text-info-primary bg-info-background text-text-info-primary"
                    : "border-border-default bg-background text-text-neutral-secondary hover:bg-foreground"
                }`}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: opt.swatch }}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Assistant name"
        hint="Shown in the welcome greeting. Leave blank to use the agent's name."
      >
        <input
          type="text"
          value={prefs.assistantName}
          onChange={(e) => setPreferences({ assistantName: e.target.value })}
          placeholder="e.g. Claude, Atlas, Hermes…"
          maxLength={40}
          className="rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-border-default"
        />
      </Field>
    </div>
  );
}

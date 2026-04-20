"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Moon, Sun, Flower2, Square } from "lucide-react";
import { useTheme } from "@/lib/hooks/useTheme";
import type { Mode, Palette } from "@/lib/user-prefs";

const PALETTE_OPTIONS: Array<{ value: Palette; label: string; icon: typeof Flower2 }> = [
  { value: "bloom", label: "Bloom", icon: Flower2 },
  { value: "neo", label: "Neo", icon: Square },
];

const MODE_OPTIONS: Array<{ value: Mode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const DIALOG_STYLE: CSSProperties = {
  backgroundColor: "var(--color-popover)",
  color: "var(--color-text-primary)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-4xl)",
  padding: "var(--sp-xl)",
  width: "100%",
  maxWidth: 420,
  boxShadow: "var(--shadow-float)",
  outline: "none",
};

const SECTION_LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-xs)",
  fontWeight: "var(--fw-medium)",
  color: "var(--color-text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: "var(--sp-s)",
};

const SEGMENTED_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "var(--sp-xs)",
  padding: "var(--sp-3xs)",
  backgroundColor: "var(--color-sunk-light)",
  borderRadius: "var(--r-l)",
};

function segmentButtonStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sp-xs)",
    padding: "var(--sp-sm) var(--sp-s)",
    borderRadius: "var(--r-m)",
    border: "none",
    backgroundColor: active ? "var(--color-bg)" : "transparent",
    color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    fontFamily: "var(--font-label)",
    fontSize: "var(--fs-sm)",
    fontWeight: active ? "var(--fw-medium)" : "var(--fw-regular)",
    boxShadow: active ? "var(--shadow-sm)" : "none",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
  };
}

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "var(--sp-sm) var(--sp-m)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-l)",
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--fs-sm)",
  outline: "none",
};

const CLOSE_BUTTON_STYLE: CSSProperties = {
  marginTop: "var(--sp-ml)",
  padding: "var(--sp-sm) var(--sp-ml)",
  border: "none",
  borderRadius: "var(--r-l)",
  backgroundColor: "var(--color-accent)",
  color: "var(--color-text-white)",
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-sm)",
  fontWeight: "var(--fw-medium)",
  cursor: "pointer",
  alignSelf: "flex-end",
};

interface ThemeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeModal({ open, onClose }: ThemeModalProps) {
  const { palette, mode, name, setPalette, setMode, setName } = useTheme();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} style={DIALOG_STYLE} onClose={onClose}>
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--fs-lg)",
          fontWeight: "var(--fw-bold)",
          marginBottom: "var(--sp-ml)",
        }}
      >
        Appearance
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-ml)" }}>
        <div>
          <div style={SECTION_LABEL_STYLE}>Your name</div>
          <input
            type="text"
            value={name ?? ""}
            onChange={(e) => setName(e.target.value || undefined)}
            placeholder="e.g. Parikshit"
            style={INPUT_STYLE}
            maxLength={40}
          />
        </div>

        <div>
          <div style={SECTION_LABEL_STYLE}>Palette</div>
          <div style={SEGMENTED_STYLE}>
            {PALETTE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = palette === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPalette(opt.value)}
                  style={segmentButtonStyle(active)}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={SECTION_LABEL_STYLE}>Mode</div>
          <div style={SEGMENTED_STYLE}>
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  style={segmentButtonStyle(active)}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={onClose} style={CLOSE_BUTTON_STYLE}>
          Done
        </button>
      </div>
    </dialog>
  );
}

export default ThemeModal;

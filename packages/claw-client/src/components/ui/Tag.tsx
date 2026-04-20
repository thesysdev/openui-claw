import type { ReactNode } from "react";

type Tone = "info" | "success" | "alert" | "danger" | "purple" | "pink" | "neutral";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: "var(--color-info-bg)", fg: "var(--color-text-info)" },
  success: { bg: "var(--color-success-bg)", fg: "var(--color-text-success)" },
  alert: { bg: "var(--color-alert-bg)", fg: "var(--color-text-alert)" },
  danger: { bg: "var(--color-danger-bg)", fg: "var(--color-text-danger)" },
  purple: { bg: "var(--color-purple-bg)", fg: "var(--color-text-purple)" },
  pink: { bg: "var(--color-pink-bg)", fg: "var(--color-text-pink)" },
  neutral: { bg: "var(--color-sunk-light)", fg: "var(--color-text-secondary)" },
};

const TAG_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 6px",
  borderRadius: "var(--r-s)",
  fontFamily: "var(--font-label)",
  fontSize: "var(--fs-2xs)",
  fontWeight: "var(--fw-medium)",
  lineHeight: 1.2,
  whiteSpace: "nowrap" as const,
};

interface TagProps {
  tone?: Tone;
  children: ReactNode;
}

export function Tag({ tone = "neutral", children }: TagProps) {
  const tones = TONE_STYLES[tone];
  return (
    <span
      style={{
        ...TAG_STYLE,
        backgroundColor: tones.bg,
        color: tones.fg,
      }}
    >
      {children}
    </span>
  );
}

export default Tag;

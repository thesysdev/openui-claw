import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@openuidev/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        "popover-background": "var(--color-popover-background)",
        "sunk-light": "var(--color-sunk-light)",
        sunk: "var(--color-sunk)",
        "sunk-deep": "var(--color-sunk-deep)",
        "elevated-light": "var(--color-elevated-light)",
        elevated: "var(--color-elevated)",
        "elevated-strong": "var(--color-elevated-strong)",
        "elevated-intense": "var(--color-elevated-intense)",
        overlay: "var(--color-overlay)",
        "highlight-subtle": "var(--color-highlight-subtle)",
        highlight: "var(--color-highlight)",
        "highlight-strong": "var(--color-highlight-strong)",
        "highlight-intense": "var(--color-highlight-intense)",
        "inverted-background": "var(--color-inverted-background)",

        // ── Backgrounds ──
        "info-background": "var(--color-info-background)",
        "success-background": "var(--color-success-background)",
        "alert-background": "var(--color-alert-background)",
        "danger-background": "var(--color-danger-background)",
        "purple-background": "var(--color-purple-background)",
        "pink-background": "var(--color-pink-background)",

        // ── Text ──
        "text-neutral-primary": "rgb(var(--color-text-neutral-primary) / <alpha-value>)",
        "text-neutral-secondary": "rgb(var(--color-text-neutral-secondary) / <alpha-value>)",
        "text-neutral-tertiary": "rgb(var(--color-text-neutral-tertiary) / <alpha-value>)",
        "text-neutral-link": "var(--color-text-neutral-link)",
        "text-brand": "var(--color-text-brand)",
        "text-white": "var(--color-text-white)",
        "text-black": "var(--color-text-black)",
        "text-accent-primary": "rgb(var(--color-text-accent-primary) / <alpha-value>)",
        "text-accent-secondary": "rgb(var(--color-text-accent-secondary) / <alpha-value>)",
        "text-accent-tertiary": "rgb(var(--color-text-accent-tertiary) / <alpha-value>)",
        "text-success-primary": "var(--color-text-success-primary)",
        "text-success-inverted": "var(--color-text-success-inverted)",
        "text-alert-primary": "var(--color-text-alert-primary)",
        "text-alert-inverted": "var(--color-text-alert-inverted)",
        "text-danger-primary": "var(--color-text-danger-primary)",
        "text-danger-secondary": "var(--color-text-danger-secondary)",
        "text-danger-tertiary": "var(--color-text-danger-tertiary)",
        "text-danger-inverted-primary": "var(--color-text-danger-inverted-primary)",
        "text-danger-inverted-secondary": "var(--color-text-danger-inverted-secondary)",
        "text-danger-inverted-tertiary": "var(--color-text-danger-inverted-tertiary)",
        "text-info-primary": "var(--color-text-info-primary)",
        "text-info-inverted": "var(--color-text-info-inverted)",
        "text-pink-primary": "var(--color-text-pink-primary)",
        "text-pink-inverted": "var(--color-text-pink-inverted)",
        "text-purple-primary": "var(--color-text-purple-primary)",
        "text-purple-inverted": "var(--color-text-purple-inverted)",

        // ── Interactive ──
        "interactive-accent": "var(--color-interactive-accent-default)",
        "interactive-accent-hover": "var(--color-interactive-accent-hover)",
        "interactive-accent-disabled": "var(--color-interactive-accent-disabled)",
        "interactive-accent-pressed": "var(--color-interactive-accent-pressed)",
        "interactive-destructive": "var(--color-interactive-destructive-default)",
        "interactive-destructive-hover": "var(--color-interactive-destructive-hover)",
        "interactive-destructive-disabled": "var(--color-interactive-destructive-disabled)",
        "interactive-destructive-pressed": "var(--color-interactive-destructive-pressed)",

        // ── Borders ──
        "border-default": "rgb(var(--color-border-default) / <alpha-value>)",
        "border-interactive": "var(--color-border-interactive)",
        "border-interactive-emphasis": "var(--color-border-interactive-emphasis)",
        "border-interactive-selected": "var(--color-border-interactive-selected)",
        "border-accent": "rgb(var(--color-border-accent) / <alpha-value>)",
        "border-accent-emphasis": "var(--color-border-accent-emphasis)",
        "border-accent-selected": "var(--color-border-accent-selected)",
        // rgb(var(...) / <alpha-value>) so `/N` modifiers (e.g.
        // `border-border-success/40`) resolve correctly. The base CSS
        // tokens below are stored as space-separated rgb channels.
        "border-info": "rgb(var(--color-border-info) / <alpha-value>)",
        "border-info-emphasis": "var(--color-border-info-emphasis)",
        "border-alert": "rgb(var(--color-border-alert) / <alpha-value>)",
        "border-alert-emphasis": "var(--color-border-alert-emphasis)",
        "border-success": "rgb(var(--color-border-success) / <alpha-value>)",
        "border-success-emphasis": "var(--color-border-success-emphasis)",
        "border-danger": "rgb(var(--color-border-danger) / <alpha-value>)",
        "border-danger-emphasis": "var(--color-border-danger-emphasis)",

        // ── Chat-specific ──
        "chat-user-bg": "var(--color-chat-user-response-bg)",
        "chat-user-text": "var(--color-chat-user-response-text)",

        // ── Bloom category colors (icon tiles) ──
        // rgb(var(--...) / <alpha-value>) so `/10` etc. work for tinted fills.
        "cat-agent": "rgb(var(--bloom-cat-agent) / <alpha-value>)",
        "cat-app": "rgb(var(--bloom-cat-app) / <alpha-value>)",
        "cat-artifact": "rgb(var(--bloom-cat-artifact) / <alpha-value>)",
        "cat-activity": "rgb(var(--bloom-cat-activity) / <alpha-value>)",
        "cat-task": "rgb(var(--bloom-cat-task) / <alpha-value>)",
        "cat-context": "rgb(var(--bloom-cat-context) / <alpha-value>)",

        // ── Status indicators ──
        "status-online": "var(--color-status-online)",
        "status-warning": "var(--color-status-warning)",
        "status-error": "var(--color-status-error)",
        "status-muted": "var(--color-status-muted)",
      },
      borderRadius: {
        none: "var(--radius-none)",
        "3xs": "var(--radius-3xs)",
        "2xs": "var(--radius-2xs)",
        xs: "var(--radius-xs)",
        s: "var(--radius-s)",
        m: "var(--radius-m)",
        // NOTE: named `lg`, not `l` — Tailwind reserves `rounded-l` as the
        // directional shortcut for left-side corners, which would silently
        // clobber our token.
        lg: "var(--radius-l)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        "4xl": "var(--radius-4xl)",
        "5xl": "var(--radius-5xl)",
        "6xl": "var(--radius-6xl)",
        "7xl": "var(--radius-7xl)",
        "8xl": "var(--radius-8xl)",
        "9xl": "var(--radius-9xl)",
        full: "var(--radius-full)",
      },
      spacing: {
        "000": "var(--space-000)",
        "3xs": "var(--space-3xs)",
        "2xs": "var(--space-2xs)",
        xs: "var(--space-xs)",
        s: "var(--space-s)",
        sm: "var(--space-sm)",
        m: "var(--space-m)",
        ml: "var(--space-ml)",
        l: "var(--space-l)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
      },
      // Only three canonical text sizes: 12 / 14 / 20. Aliases force
      // any legacy `text-xs`, `text-xl`, etc. to snap to one of the three
      // rather than leaking Tailwind's default sizes.
      fontSize: {
        "2xs": "var(--font-size-sm)",
        xs: "var(--font-size-sm)",
        sm: "var(--font-size-sm)",
        base: "var(--font-size-md)",
        md: "var(--font-size-md)",
        lg: "var(--font-size-lg)",
        xl: "var(--font-size-lg)",
        "2xl": "var(--font-size-lg)",
        "3xl": "var(--font-size-lg)",
        "4xl": "var(--font-size-lg)",
        "5xl": "var(--font-size-lg)",
        // Exception: reserved for the sidebar Logo only.
        logo: "var(--font-size-logo)",
      },
      fontWeight: {
        regular: "var(--font-weight-regular)",
        medium: "var(--font-weight-medium)",
        bold: "var(--font-weight-bold)",
        heavy: "var(--font-weight-heavy)",
      },
      fontFamily: {
        body: "var(--font-body)",
        code: "var(--font-code)",
        heading: "var(--font-heading)",
        label: "var(--font-label)",
        numbers: "var(--font-numbers)",
      },
      lineHeight: {
        body: "var(--line-height-body)",
        heading: "var(--line-height-heading)",
        "heading-large": "var(--line-height-heading-large)",
        label: "var(--line-height-label)",
        code: "var(--line-height-code)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        panel: "var(--shadow-panel)",
      },
    },
  },
  plugins: [typography],
};

export default config;

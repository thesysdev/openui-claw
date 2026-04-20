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
        bg: "var(--color-bg)",
        fg: "var(--color-fg)",
        popover: "var(--color-popover)",
        sunk: {
          light: "var(--color-sunk-light)",
          DEFAULT: "var(--color-sunk)",
          deep: "var(--color-sunk-deep)",
        },
        elevated: {
          light: "var(--color-elevated-light)",
          DEFAULT: "var(--color-elevated)",
          strong: "var(--color-elevated-strong)",
          intense: "var(--color-elevated-intense)",
        },
        highlight: {
          subtle: "var(--color-highlight-subtle)",
          DEFAULT: "var(--color-highlight)",
          strong: "var(--color-highlight-strong)",
          intense: "var(--color-highlight-intense)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          link: "var(--color-text-link)",
          brand: "var(--color-text-brand)",
          accent: "var(--color-text-accent-primary)",
          success: "var(--color-text-success)",
          alert: "var(--color-text-alert)",
          danger: "var(--color-text-danger)",
          info: "var(--color-text-info)",
          pink: "var(--color-text-pink)",
          purple: "var(--color-text-purple)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          pressed: "var(--color-accent-pressed)",
          disabled: "var(--color-accent-disabled)",
        },
        destructive: {
          DEFAULT: "var(--color-destructive)",
          hover: "var(--color-destructive-hover)",
          pressed: "var(--color-destructive-pressed)",
          disabled: "var(--color-destructive-disabled)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          interactive: "var(--color-border-interactive)",
          selected: "var(--color-border-interactive-selected)",
          accent: "var(--color-border-accent)",
        },
        status: {
          info: "var(--color-info-bg)",
          success: "var(--color-success-bg)",
          alert: "var(--color-alert-bg)",
          danger: "var(--color-danger-bg)",
          purple: "var(--color-purple-bg)",
          pink: "var(--color-pink-bg)",
        },
        cat: {
          agent: "var(--cat-agent)",
          app: "var(--cat-app)",
          artifact: "var(--cat-artifact)",
          activity: "var(--cat-activity)",
          task: "var(--cat-task)",
          context: "var(--cat-context)",
        },
      },
      fontFamily: {
        body: "var(--font-body)",
        heading: "var(--font-heading)",
        label: "var(--font-label)",
        code: "var(--font-code)",
        numbers: "var(--font-numbers)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        panel: "var(--shadow-panel)",
      },
    },
  },
  plugins: [typography],
};

export default config;

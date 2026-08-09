import { registerTheme } from "@/lib/theme";

registerTheme({
  id: "dark",
  label: "夜读",
  description: "深色护眼主题，适合晚间背单词",
  scheme: "dark",
  variables: {
    "--wl-primary": "#818cf8",
    "--wl-primary-fg": "#0f172a",
    "--wl-accent": "#22d3ee",
    "--wl-bg": "#0b1120",
    "--wl-surface": "#151e31",
    "--wl-surface-2": "#223049",
    "--wl-border": "#2c3a55",
    "--wl-text": "#e2e8f0",
    "--wl-muted": "#8ea0bd",
    "--wl-danger": "#f87171",
    "--wl-success": "#4ade80",
    "--wl-warning": "#fbbf24",
    "--wl-radius": "0.75rem",
  },
});

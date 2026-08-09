import { registerTheme } from "@/lib/theme";

registerTheme({
  id: "default",
  label: "默认",
  description: "清爽的蓝紫色默认主题",
  scheme: "light",
  variables: {
    "--wl-primary": "#6366f1",
    "--wl-primary-fg": "#ffffff",
    "--wl-accent": "#0ea5e9",
    "--wl-bg": "#f8fafc",
    "--wl-surface": "#ffffff",
    "--wl-surface-2": "#f1f5f9",
    "--wl-border": "#e2e8f0",
    "--wl-text": "#0f172a",
    "--wl-muted": "#64748b",
    "--wl-danger": "#ef4444",
    "--wl-success": "#22c55e",
    "--wl-warning": "#f59e0b",
    "--wl-radius": "0.625rem",
  },
});

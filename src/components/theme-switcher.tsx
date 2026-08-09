"use client";

import { useState } from "react";
import { getThemes, applyTheme } from "@/lib/theme";
import { Palette } from "lucide-react";
import "@/themes/default";
import "@/themes/dark";

const themes = getThemes();

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(
    typeof window !== "undefined"
      ? (localStorage.getItem("wordlink:theme") ?? "dark")
      : "dark"
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text"
      >
        <Palette className="h-4 w-4" />
        主题
        <span className="ml-auto text-xs text-muted">
          {themes.find((t) => t.id === current)?.label ?? ""}
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-border bg-surface p-2 shadow-lg">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => {
                applyTheme(theme.id);
                setCurrent(theme.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text hover:bg-surface-2"
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-border"
                style={{
                  background: `linear-gradient(135deg, ${theme.variables["--wl-primary"]}, ${theme.variables["--wl-accent"]})`,
                }}
              />
              {theme.label}
              {theme.description && (
                <span className="ml-auto max-w-[120px] truncate text-xs text-muted">
                  {theme.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

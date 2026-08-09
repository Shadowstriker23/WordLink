"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import "@/themes/default";
import "@/themes/dark";

export function ThemeProvider() {
  useEffect(() => {
    const stored = getStoredTheme();
    applyTheme(stored ?? "dark");
  }, []);
  return null;
}

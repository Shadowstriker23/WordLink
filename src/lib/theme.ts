export interface Theme {
  id: string;
  label: string;
  description?: string;
  scheme?: "light" | "dark";
  variables: Record<string, string>;
}

const themes = new Map<string, Theme>();

export function registerTheme(theme: Theme) {
  themes.set(theme.id, theme);
}

export function getThemes(): Theme[] {
  return [...themes.values()];
}

export function getTheme(id: string): Theme | undefined {
  return themes.get(id);
}

export function applyTheme(id: string) {
  const theme = themes.get(id);
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }
  if (theme.scheme) {
    root.style.colorScheme = theme.scheme;
  }
  try {
    localStorage.setItem("wordlink:theme", id);
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): string | null {
  try {
    return localStorage.getItem("wordlink:theme");
  } catch {
    return null;
  }
}

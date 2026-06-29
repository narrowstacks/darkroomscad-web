import type { ThemeName } from "./themes";

const ORDER: ThemeName[] = ["dark", "light", "darkroom", "high-contrast"];
const VALID = new Set<ThemeName>(ORDER);

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): ThemeName {
  if (stored && VALID.has(stored as ThemeName)) return stored as ThemeName;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(current: ThemeName): ThemeName {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length];
}

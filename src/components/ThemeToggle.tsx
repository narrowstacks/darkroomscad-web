"use client";
import { useTheme } from "./ThemeProvider";
import { nextTheme } from "@/lib/theme/resolve";
import type { ThemeName } from "@/lib/theme/themes";

// Record<ThemeName,…> so adding a 5th theme can't ship without a label.
const LABEL: Record<ThemeName, string> = {
  dark: "Dark", light: "Light", darkroom: "Safelight", "high-contrast": "High contrast",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(nextTheme(theme))}
      aria-label={`Theme: ${LABEL[theme]}. Click to change.`}
      className="rounded-lg px-3 py-1.5 text-sm focus-visible:outline-2"
      style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
      Theme: {LABEL[theme]}
    </button>
  );
}

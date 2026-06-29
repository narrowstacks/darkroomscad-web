export type ThemeName = "dark" | "light" | "darkroom" | "high-contrast";

export interface ThemeTokens {
  vars: Record<string, string>;
  viewer: { model: string; grid: string; background: string };
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    vars: {
      "--bg": "#09090b", "--surface": "#121214", "--surface-muted": "#1c1c1f",
      "--border": "rgba(255,255,255,0.1)", "--border-strong": "rgba(255,255,255,0.2)",
      "--text": "#ffffff", "--text-muted": "#a1a1aa", "--text-dim": "#71717a",
      "--primary": "#6ef3a4", "--secondary": "#7dd6ff", "--accent": "#f99f96",
      "--highlight": "#e5ff7d", "--error": "#f99f96", "--success": "#6ef3a4",
      "--viewer-model": "#9a9a9a", "--viewer-grid": "#353535",
    },
    viewer: { model: "#9a9a9a", grid: "#353535", background: "#121214" },
  },
  light: {
    vars: {
      "--bg": "#ffffff", "--surface": "#f8f9fa", "--surface-muted": "#f1f3f4",
      "--border": "rgba(0,0,0,0.12)", "--border-strong": "rgba(0,0,0,0.24)",
      "--text": "#09090b", "--text-muted": "#52525b", "--text-dim": "#71717a",
      "--primary": "#2d7a4a", "--secondary": "#1e6091", "--accent": "#c4524a",
      "--highlight": "#8b9c2e", "--error": "#c4524a", "--success": "#2d7a4a",
      "--viewer-model": "#b8b8b8", "--viewer-grid": "#d4d4d8",
    },
    viewer: { model: "#b8b8b8", grid: "#d4d4d8", background: "#f8f9fa" },
  },
  darkroom: {
    vars: {
      "--bg": "#000000", "--surface": "#0a0000", "--surface-muted": "#140000",
      "--border": "#5a0000", "--border-strong": "#7a0000",
      "--text": "#ff2a2a", "--text-muted": "#a90000", "--text-dim": "#7a0000",
      "--primary": "#ff2a2a", "--secondary": "#ff2a2a", "--accent": "#ff2a2a",
      "--highlight": "#ff2a2a", "--error": "#ff6a6a", "--success": "#ff2a2a",
      "--viewer-model": "#8a0000", "--viewer-grid": "#3a0000",
    },
    viewer: { model: "#8a0000", grid: "#3a0000", background: "#0a0000" },
  },
  "high-contrast": {
    vars: {
      "--bg": "#000000", "--surface": "#000000", "--surface-muted": "#111111",
      "--border": "#ffffff", "--border-strong": "#ffffff",
      "--text": "#ffffff", "--text-muted": "#e4e4e7", "--text-dim": "#a1a1aa",
      "--primary": "#ffff00", "--secondary": "#00ffff", "--accent": "#ffff00",
      "--highlight": "#ffff00", "--error": "#ff6a6a", "--success": "#00ff00",
      "--viewer-model": "#d4d4d4", "--viewer-grid": "#666666",
    },
    viewer: { model: "#d4d4d4", grid: "#666666", background: "#000000" },
  },
};

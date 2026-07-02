"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { THEMES, type ThemeName, type ThemeTokens } from "@/lib/theme/themes";
import { resolveInitialTheme } from "@/lib/theme/resolve";
import { safeGet, safeSet } from "@/lib/storage/local-storage";

const STORAGE_KEY = "darkroomscad-theme";

const ThemeContext = createContext<{
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  viewer: ThemeTokens["viewer"];
}>({ theme: "dark", setTheme: () => {}, viewer: THEMES.dark.viewer });

function applyVars(theme: ThemeName) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(THEMES[theme].vars)) root.style.setProperty(k, v);
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("dark");
  useEffect(() => {
    const stored = safeGet(STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = resolveInitialTheme(stored, prefersDark);
    setThemeState(initial);
    applyVars(initial);
  }, []);
  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    applyVars(t);
    safeSet(STORAGE_KEY, t);
  };
  return (
    <ThemeContext.Provider value={{ theme, setTheme, viewer: THEMES[theme].viewer }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

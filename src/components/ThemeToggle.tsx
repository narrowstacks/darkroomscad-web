"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Contrast, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import type { ThemeName } from "@/lib/theme/themes";

const OPTIONS: { value: ThemeName; label: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "darkroom", label: "Safelight", icon: Camera },
  { value: "high-contrast", label: "High contrast", icon: Contrast },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Current = OPTIONS.find((o) => o.value === theme)?.icon ?? Moon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="icon-button size-9" aria-haspopup="menu" aria-expanded={open} aria-label="Change theme">
        <Current className="size-4" />
      </button>
      {open && (
        <div role="menu" className="menu-surface animate-scale-fade-in absolute right-0 top-full z-50 mt-2 min-w-52 p-1.5">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = o.value === theme;
            return (
              <button key={o.value} type="button" role="menuitem"
                onClick={() => { setTheme(o.value); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
                style={{ color: active ? "var(--text)" : "var(--text-muted)",
                  background: active ? "var(--surface-muted)" : "transparent" }}>
                <Icon className="size-4 shrink-0" style={{ color: active ? "var(--primary)" : "var(--text-dim)" }} />
                <span className="flex-1">{o.label}</span>
                {active && <Check className="size-4 shrink-0" style={{ color: "var(--primary)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

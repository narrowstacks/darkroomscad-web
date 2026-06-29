"use client";
import { FORMAT_CHIPS, fromFilmFormatValue, toFilmFormatValue } from "@/lib/film-format";
import { Switch } from "./Switch";

const MAX = 44; // px, long edge of the frame glyph

function frameSize([w, h]: [number, number]): { width: number; height: number } {
  const scale = MAX / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function FilmFormatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isCustom = value === "custom";
  const { base, filed } = isCustom ? { base: "", filed: false } : fromFilmFormatValue(value);
  const activeChip = FORMAT_CHIPS.find((c) => c.base === base);

  return (
    <div className="py-1">
      <span className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Film format</span>
      <div className="flex flex-wrap gap-2">
        {FORMAT_CHIPS.map((chip) => {
          const selected = !isCustom && chip.base === base;
          const { width, height } = frameSize(chip.ratio);
          return (
            <button key={chip.base} type="button" aria-pressed={selected}
              onClick={() => onChange(toFilmFormatValue(chip.base, filed))}
              className="flex flex-col items-center justify-end gap-1 rounded-lg px-3 py-2 transition-colors focus-visible:outline-2"
              style={{ width: 76, height: 76,
                background: selected ? "var(--surface-muted)" : "var(--surface)",
                border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}` }}>
              <span className="flex flex-1 items-center justify-center">
                <span style={{ width, height, border: `2px solid ${selected ? "var(--primary)" : "var(--text-dim)"}`, borderRadius: 2 }} />
              </span>
              <span className="text-xs" style={{ color: selected ? "var(--text)" : "var(--text-muted)" }}>{chip.label}</span>
            </button>
          );
        })}
        <button type="button" aria-pressed={isCustom} onClick={() => onChange("custom")}
          className="flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors focus-visible:outline-2"
          style={{ width: 76, height: 76,
            background: isCustom ? "var(--surface-muted)" : "var(--surface)",
            border: `1px solid ${isCustom ? "var(--primary)" : "var(--border)"}`,
            color: isCustom ? "var(--text)" : "var(--text-muted)" }}>
          <span className="text-lg leading-none">＋</span>
          <span className="text-xs">Custom</span>
        </button>
      </div>

      {activeChip?.hasFiled && (
        <div className="mt-2">
          <Switch checked={filed} onChange={(f) => onChange(toFilmFormatValue(base, f))}
            label="Filed edges" help="Wider opening that shows the filed negative edge." />
        </div>
      )}
    </div>
  );
}

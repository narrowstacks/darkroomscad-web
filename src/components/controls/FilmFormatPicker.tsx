"use client";
import { FORMAT_CHIPS, fromFilmFormatValue, toFilmFormatValue } from "@/lib/film-format";
import { Switch } from "./Switch";

const MAX = 44; // px, long edge of the frame glyph

function frameSize([w, h]: [number, number]): { width: number; height: number } {
  const scale = MAX / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function FilmFormatPicker({ value, onChange, disabledBases, lockedBase }: {
  value: string;
  onChange: (v: string) => void;
  /** Format bases the current carrier can't take — rendered disabled. */
  disabledBases?: ReadonlySet<string>;
  /** The one base the carrier is locked to (e.g. the glass-plate carrier → 4x5):
   *  every other chip and Custom render disabled. */
  lockedBase?: string | null;
}) {
  const isCustom = value === "custom";
  const { base, filed } = isCustom ? { base: "", filed: false } : fromFilmFormatValue(value);
  const activeChip = FORMAT_CHIPS.find((c) => c.base === base);
  const chipDisabled = (chipBase: string) =>
    (disabledBases?.has(chipBase) ?? false) || (lockedBase != null && chipBase !== lockedBase);

  return (
    <div className="py-1">
      <span className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>Film format</span>
      <div className="flex flex-wrap gap-2">
        {FORMAT_CHIPS.map((chip) => {
          const selected = !isCustom && chip.base === base;
          const disabled = chipDisabled(chip.base);
          const { width, height } = frameSize(chip.ratio);
          return (
            <button key={chip.base} type="button" aria-pressed={selected} data-selected={selected} disabled={disabled}
              onClick={() => onChange(toFilmFormatValue(chip.base, filed))}
              className="select-card flex flex-col items-center justify-end gap-1 px-3 py-2 focus-visible:outline-2 disabled:cursor-not-allowed"
              style={{ width: 76, height: 76, opacity: disabled ? 0.35 : 1 }}>
              <span className="flex flex-1 items-center justify-center">
                <span style={{ width, height, border: `2px solid ${selected ? "var(--primary)" : "var(--text-dim)"}`, borderRadius: 2 }} />
              </span>
              <span className="text-xs">{chip.label}</span>
            </button>
          );
        })}
        <button type="button" aria-pressed={isCustom} data-selected={isCustom} onClick={() => onChange("custom")}
          disabled={lockedBase != null}
          className="select-card flex flex-col items-center justify-center gap-1 px-3 py-2 focus-visible:outline-2 disabled:cursor-not-allowed"
          style={{ width: 76, height: 76, opacity: lockedBase != null ? 0.35 : 1 }}>
          <span className="text-lg leading-none">＋</span>
          <span className="text-xs">Custom</span>
        </button>
      </div>
      {lockedBase != null && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
          Locked to {FORMAT_CHIPS.find((c) => c.base === lockedBase)?.label ?? lockedBase} — this carrier only takes that size.
        </p>
      )}

      {activeChip?.hasFiled && (
        <div className="mt-2">
          <Switch checked={filed} onChange={(f) => onChange(toFilmFormatValue(base, f))}
            label="Filed edges" help="Wider opening that enables enlarging the areas around a negative's frame" />
        </div>
      )}
    </div>
  );
}

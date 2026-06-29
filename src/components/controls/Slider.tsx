"use client";
import { clampSlider } from "@/lib/form/control-value";

export function Slider({ value, min, max, step, onChange, label, unit }: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</label>
        <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
          {value}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input type="range" value={value}
        min={min ?? 0} max={max ?? 100} step={step ?? 1}
        onChange={(e) => onChange(clampSlider(Number(e.target.value), min, max))}
        className="mt-1 w-full accent-[var(--primary)]" style={{ accentColor: "var(--primary)" }} />
    </div>
  );
}

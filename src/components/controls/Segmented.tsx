"use client";
import { coerceOptionValue } from "@/lib/form/control-value";
import type { FormValue } from "@/lib/form/types";

export function Segmented({ options, value, onChange, label, ariaLabel, disabledOptions }: {
  options: { value: string | number; label: string }[];
  value: FormValue;
  onChange: (v: FormValue) => void;
  label: string;
  ariaLabel?: string;
  disabledOptions?: (string | number)[];
}) {
  const isDisabled = (v: string | number) =>
    disabledOptions?.some((d) => String(d) === String(v)) ?? false;
  return (
    <div className="py-1">
      <span className="block text-sm font-medium mb-1" style={{ color: "var(--text)" }}>{label}</span>
      <div role="group" aria-label={ariaLabel ?? label}
        className="inline-flex flex-wrap gap-1 rounded-xl p-1"
        style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
        {options.map((o) => {
          const selected = String(o.value) === String(value);
          const disabled = isDisabled(o.value);
          return (
            <button key={String(o.value)} type="button" aria-pressed={selected} disabled={disabled}
              onClick={() => onChange(coerceOptionValue(options, String(o.value)))}
              className="rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 disabled:cursor-not-allowed"
              style={selected
                ? { background: "var(--primary)", color: "var(--on-primary)", fontWeight: 600 }
                : { color: "var(--text-muted)", opacity: disabled ? 0.4 : 1 }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

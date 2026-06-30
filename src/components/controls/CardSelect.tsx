"use client";
import type * as React from "react";
import { coerceOptionValue } from "@/lib/form/control-value";
import type { FormValue } from "@/lib/form/types";

export function CardSelect({ options, value, onChange, label, renderVisual }: {
  options: { value: string | number; label: string }[];
  value: FormValue;
  onChange: (v: FormValue) => void;
  label: string;
  renderVisual?: (value: string | number) => React.ReactNode;
}) {
  return (
    <div className="py-1">
      <span className="block text-sm font-medium mb-1.5" style={{ color: "var(--text)" }}>{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const selected = String(o.value) === String(value);
          return (
            <button key={String(o.value)} type="button" aria-pressed={selected} data-selected={selected}
              onClick={() => onChange(coerceOptionValue(options, String(o.value)))}
              className="select-card flex flex-col items-center justify-start gap-2 px-3 py-3 text-center text-sm focus-visible:outline-2">
              {renderVisual && (
                <span className="flex h-12 shrink-0 items-center justify-center" aria-hidden>
                  {renderVisual(o.value)}
                </span>
              )}
              {/* Reserve two lines so single- and double-line labels keep the icon and
                  text at the same position across cards in a row (no stagger). */}
              <span className="flex min-h-[2.25rem] items-center leading-tight">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

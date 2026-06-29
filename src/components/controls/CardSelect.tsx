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
            <button key={String(o.value)} type="button" aria-pressed={selected}
              onClick={() => onChange(coerceOptionValue(options, String(o.value)))}
              className="rounded-lg px-3 py-2.5 text-sm text-left transition-colors focus-visible:outline-2"
              style={{
                background: selected ? "var(--surface-muted)" : "var(--surface)",
                border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                color: selected ? "var(--text)" : "var(--text-muted)",
              }}>
              {renderVisual && (
                <span className="mb-1.5 flex h-10 items-center justify-center" aria-hidden>
                  {renderVisual(o.value)}
                </span>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

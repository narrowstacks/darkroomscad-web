"use client";
import type { ResolvedField, FormValue } from "@/lib/form/types";

export function Field({ field, value, onChange }: {
  field: ResolvedField;
  value: FormValue;
  onChange: (v: FormValue) => void;
}) {
  const id = `field-${field.param}`;
  const labelEl = (
    <label htmlFor={id} className="block text-sm font-medium" style={{ color: "var(--text)" }}>
      {field.label}
    </label>
  );
  const help = field.help ? (
    <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{field.help}</p>
  ) : null;

  if (field.control === "toggle") {
    return (
      <div className="flex items-center gap-3 py-1">
        <input id={id} type="checkbox" checked={value === true}
          onChange={(e) => onChange(e.target.checked)} />
        <div>{labelEl}{help}</div>
      </div>
    );
  }

  const inputStyle = {
    background: "var(--surface-muted)", color: "var(--text)",
    border: "1px solid var(--border)",
  } as const;

  return (
    <div className="py-1">
      {labelEl}{help}
      {field.control === "select" ? (
        <select id={id} value={String(value)} onChange={(e) => {
          const opt = field.options?.find((o) => String(o.value) === e.target.value);
          onChange(opt ? opt.value : e.target.value);
        }} className="mt-1 w-full rounded px-2 py-1.5 text-sm" style={inputStyle}>
          {field.options?.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
      ) : field.control === "number" ? (
        <input id={id} type="number" value={Number(value)}
          min={field.min} max={field.max} step={field.step ?? "any"}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="mt-1 w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
      ) : (
        <input id={id} type="text" value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded px-2 py-1.5 text-sm" style={inputStyle} />
      )}
    </div>
  );
}

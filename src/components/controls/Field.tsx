"use client";
import type { ResolvedField, FormValue } from "@/lib/form/types";
import { Segmented } from "./Segmented";
import { Switch } from "./Switch";
import { Slider } from "./Slider";
import { CardSelect } from "./CardSelect";
import { TextInput } from "./TextInput";
import { coerceOptionValue } from "@/lib/form/control-value";
import { CARRIER_OUTLINES } from "@/lib/outline/outlines";

export function Field({ field, value, onChange, disabled, disabledOptions }: {
  field: ResolvedField;
  value: FormValue;
  onChange: (v: FormValue) => void;
  disabled?: boolean;
  disabledOptions?: (string | number)[];
}) {
  const id = `field-${field.param}`;
  switch (field.control) {
    case "segmented":
      return <Segmented options={field.options ?? []} value={value} onChange={onChange} label={field.label}
        disabledOptions={disabledOptions} />;
    case "cards":
      return <CardSelect options={field.options ?? []} value={value} onChange={onChange} label={field.label}
        renderVisual={field.optionVisual === "carrier-outline"
          ? (v) => {
              const o = CARRIER_OUTLINES[String(v)];
              // Inline SVG with fill="currentColor" so the silhouette follows the card's
              // text color (white in dark, dark in light, red in safelight).
              return o ? (
                <svg viewBox={o.viewBox} aria-hidden fill="currentColor"
                  preserveAspectRatio="xMidYMid meet" className="h-11 w-auto opacity-90">
                  <path d={o.d} />
                </svg>
              ) : null;
            }
          : undefined} />;
    case "switch":
    case "toggle":
      return <Switch checked={value === true} onChange={onChange} label={field.label} help={field.help} disabled={disabled} />;
    case "slider":
      return <Slider value={Number(value)} min={field.min} max={field.max} step={field.step}
        onChange={onChange} label={field.label} unit={field.unit} />;
    case "select":
      return (
        <div className="py-1">
          <label htmlFor={id} className="block text-sm font-medium" style={{ color: "var(--text)" }}>{field.label}</label>
          <select id={id} value={String(value)} onChange={(e) => onChange(coerceOptionValue(field.options, e.target.value))}
            className="app-input mt-1">
            {field.options?.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </select>
        </div>
      );
    case "number":
      return (
        <div className="py-1">
          <label htmlFor={id} className="block text-sm font-medium" style={{ color: "var(--text)" }}>{field.label}</label>
          <input id={id} type="number" value={Number(value)} min={field.min} max={field.max} step={field.step ?? "any"}
            onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            className="app-input mt-1" />
        </div>
      );
    default:
      // Etch-text fields: commit only when the user pauses/blurs so the model
      // doesn't re-render on every keystroke.
      return <TextInput id={id} label={field.label} value={String(value)} onCommit={onChange} />;
  }
}

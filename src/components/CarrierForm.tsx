"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Field } from "./controls/Field";
import { FilmFormatPicker } from "./controls/FilmFormatPicker";
import type { ResolvedGroup, ResolvedField, FormValue } from "@/lib/form/types";
import { unsupportedFormats, lockedFormat } from "@/config/carriers";

const DELAY = ["", "animate-delay-50", "animate-delay-100", "animate-delay-150", "animate-delay-200", "animate-delay-300"];

// Fields that belong visually to the film-format picker and render right under
// it, ahead of the group's other fields.
const PICKER_FIELDS = new Set(["Frame_Count"]);

export function CarrierForm({ groups, values, setValue, renderGroupExtras }: {
  groups: ResolvedGroup[];
  values: Record<string, FormValue>;
  setValue: (param: string, v: FormValue) => void;
  /** Optional UI-only extras appended inside a group's section (keyed by title).
   *  Used for preview-only controls that are NOT SCAD params (e.g. the custom
   *  film-overlay picker), so they render with the group but never reach the STL. */
  renderGroupExtras?: (title: string) => React.ReactNode;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  let visibleIndex = 0;
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const fields = group.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values));
        const isAdvanced = fields.length > 0 && fields.every((f) => f.advanced);
        const showPicker = group.title === "Carrier"; // film-format picker lives in the Carrier group
        if (fields.length === 0 && !showPicker) return null;
        if (isAdvanced && !showAdvanced) {
          return (
            <button key={group.title} onClick={() => setShowAdvanced(true)}
              className="btn btn-secondary w-full px-3 py-2.5">
              <SlidersHorizontal className="size-4" style={{ color: "var(--text-dim)" }} />
              Show advanced options
            </button>
          );
        }
        const delay = DELAY[Math.min(visibleIndex++, DELAY.length - 1)];
        const renderField = (f: ResolvedField) => (
          <Field key={f.param} value={values[f.param]} onChange={(v) => setValue(f.param, v)}
            field={typeof f.help === "function" ? { ...f, help: f.help(values) } : f}
            disabled={f.disabledWhen?.(values) ?? false}
            disabledOptions={f.optionDisabledWhen
              ? (f.options ?? []).filter((o) => f.optionDisabledWhen!(o.value, values)).map((o) => o.value)
              : undefined} />
        );
        const pickerFields = showPicker ? fields.filter((f) => PICKER_FIELDS.has(f.param)) : [];
        const otherFields = showPicker ? fields.filter((f) => !PICKER_FIELDS.has(f.param)) : fields;
        return (
          <section key={group.title} className={`panel animate-slide-fade-bottom p-4 ${delay}`}>
            <h2 className="eyebrow mb-3">{group.title}</h2>
            <div className="space-y-3">
              {showPicker && (
                <FilmFormatPicker value={String(values.Film_Format)}
                  onChange={(v) => setValue("Film_Format", v)}
                  disabledBases={unsupportedFormats(String(values.Carrier_Type))}
                  lockedBase={lockedFormat(String(values.Carrier_Type))} />
              )}
              {pickerFields.map(renderField)}
              {otherFields.map(renderField)}
              {renderGroupExtras?.(group.title)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

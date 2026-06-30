"use client";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Field } from "./controls/Field";
import { FilmFormatPicker } from "./controls/FilmFormatPicker";
import type { ResolvedGroup, FormValue } from "@/lib/form/types";

const DELAY = ["", "animate-delay-50", "animate-delay-100", "animate-delay-150", "animate-delay-200", "animate-delay-300"];

export function CarrierForm({ groups, values, setValue }: {
  groups: ResolvedGroup[];
  values: Record<string, FormValue>;
  setValue: (param: string, v: FormValue) => void;
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
        return (
          <section key={group.title} className={`panel animate-slide-fade-bottom p-4 ${delay}`}>
            <h2 className="eyebrow mb-3">{group.title}</h2>
            <div className="space-y-3">
              {showPicker && (
                <FilmFormatPicker value={String(values.Film_Format)}
                  onChange={(v) => setValue("Film_Format", v)} />
              )}
              {fields.map((f) => (
                <Field key={f.param} field={f} value={values[f.param]} onChange={(v) => setValue(f.param, v)}
                  disabled={f.disabledWhen?.(values) ?? false}
                  disabledOptions={f.optionDisabledWhen
                    ? (f.options ?? []).filter((o) => f.optionDisabledWhen!(o.value, values)).map((o) => o.value)
                    : undefined} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

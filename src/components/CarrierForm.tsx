"use client";
import { useState } from "react";
import { Field } from "./controls/Field";
import type { ResolvedGroup, FormValue } from "@/lib/form/types";

export function CarrierForm({ groups, values, setValue }: {
  groups: ResolvedGroup[];
  values: Record<string, FormValue>;
  setValue: (param: string, v: FormValue) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const fields = group.fields.filter((f) => !f.visibleWhen || f.visibleWhen(values));
        if (fields.length === 0) return null;
        const isAdvanced = fields.every((f) => f.advanced);
        if (isAdvanced && !showAdvanced) {
          return (
            <button key={group.title} onClick={() => setShowAdvanced(true)}
              className="text-sm underline" style={{ color: "var(--secondary)" }}>
              Show advanced options
            </button>
          );
        }
        return (
          <section key={group.title} className="rounded-lg p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg mb-2">{group.title}</h2>
            <div className="space-y-2">
              {fields.map((f) => (
                <Field key={f.param} field={f} value={values[f.param]}
                  onChange={(v) => setValue(f.param, v)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

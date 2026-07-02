"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { CARRIER_UI } from "@/config/carrier-ui";
import { resolveFormModel } from "@/lib/form/form-model";
import { initialValues, toRenderParams } from "@/lib/form/form-state";
import { loadConfig, saveConfig } from "@/lib/storage/config-store";
import schema from "../../generated/param-schema.json";
import type { ParamSchema } from "@/lib/params/types";
import type { FormValue } from "@/lib/form/types";
import type { RenderParams } from "@/lib/openscad/types";

// The UI forbids this pair (see carrier-ui.ts guards); stored/imported state
// can still contain it, and the SCAD asserts on it (universal-carrier-assembly
// .scad:135) killing the render. Board wins; pegs fall back to heat_set
// (matches the help text: an attached board requires heat-set pegs).
function normalizeConflicts(v: Record<string, FormValue>): Record<string, FormValue> {
  if (v.Alignment_Board === true && v.Printed_or_Heat_Set_Pegs === "printed") {
    return { ...v, Printed_or_Heat_Set_Pegs: "heat_set" };
  }
  return v;
}

export function useCarrierForm() {
  const groups = useMemo(() => resolveFormModel(schema as ParamSchema, CARRIER_UI), []);

  // Every param the form owns — used to filter restored/applied values so stale
  // or foreign keys never leak into state.
  const knownKeys = useMemo(
    () => new Set<string>([...groups.flatMap((g) => g.fields.map((f) => f.param)), "Film_Format"]),
    [groups],
  );

  const seed = useMemo(() => {
    const base = initialValues(groups);
    const ff = (schema as ParamSchema).params.find((p) => p.name === "Film_Format");
    return { ...base, Film_Format: (ff?.default as FormValue) ?? "35mm" };
  }, [groups]);

  const [values, setValues] = useState<Record<string, FormValue>>(seed);

  // Restore the persisted config once, after mount — done in an effect (not the
  // useState initializer) so server and first client render both use `seed`,
  // avoiding a hydration mismatch.
  useEffect(() => {
    const stored = loadConfig(knownKeys);
    if (Object.keys(stored).length) setValues((prev) => normalizeConflicts({ ...prev, ...stored }));
  }, [knownKeys]);

  // Persist the current config (debounced) on every change.
  useEffect(() => {
    const t = setTimeout(() => saveConfig(values), 300);
    return () => clearTimeout(t);
  }, [values]);

  const setValue = useCallback((param: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [param]: value }));
  }, []);

  // Apply a saved snapshot (preset / restore), keeping only known params.
  const applyValues = useCallback((next: Record<string, FormValue>) => {
    const filtered: Record<string, FormValue> = {};
    for (const [k, v] of Object.entries(next)) if (knownKeys.has(k)) filtered[k] = v;
    setValues((prev) => normalizeConflicts({ ...prev, ...filtered }));
  }, [knownKeys]);

  const reset = useCallback(() => setValues(seed), [seed]);

  const toParams = useCallback(
    (system: Record<string, FormValue>): RenderParams =>
      toRenderParams(groups, values, { Film_Format: values.Film_Format, ...system }),
    [groups, values],
  );

  return { groups, values, setValue, applyValues, reset, toParams };
}

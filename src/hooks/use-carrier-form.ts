"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { CARRIER_UI } from "@/config/carrier-ui";
import { resolveFormModel } from "@/lib/form/form-model";
import { initialValues, toRenderParams } from "@/lib/form/form-state";
import { loadConfig, saveConfig } from "@/lib/storage/config-store";
import { encodeShare, decodeShare } from "@/lib/share/permalink";
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

  const seed = useMemo((): Record<string, FormValue> => {
    const base = initialValues(groups);
    const ff = (schema as ParamSchema).params.find((p) => p.name === "Film_Format");
    return { ...base, Film_Format: (ff?.default as FormValue) ?? "35mm" };
  }, [groups]);

  const [values, setValues] = useState<Record<string, FormValue>>(seed);

  // Restore the persisted config once, after mount — done in an effect (not the
  // useState initializer) so server and first client render both use `seed`,
  // avoiding a hydration mismatch.
  //
  // A shared-link hash (#c=<payload>) is merged in the same effect, LAST, so it
  // wins over localStorage — kept as one effect (not two) so the merge order is
  // deterministic. The hash is stripped via replaceState once applied so a
  // reload doesn't keep resurrecting the shared config over later edits; an
  // invalid/undecodable hash is left untouched (decodeShare never throws).
  useEffect(() => {
    const stored = loadConfig(knownKeys);

    const urlValues: Record<string, FormValue> = {};
    const match = /^#c=(.+)$/.exec(window.location.hash);
    if (match) {
      const decoded = decodeShare(match[1]);
      if (decoded) {
        for (const [k, v] of Object.entries(decoded)) if (knownKeys.has(k)) urlValues[k] = v;
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }

    if (Object.keys(stored).length || Object.keys(urlValues).length) {
      setValues((prev) => normalizeConflicts({ ...prev, ...stored, ...urlValues }));
    }
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

  // A copyable URL encoding only the diff vs. the seed — "" when there's
  // nothing to share (current config equals the default).
  const shareLink = useCallback(() => {
    const hasDiff = Object.entries(values).some(([k, v]) => seed[k] !== v);
    if (!hasDiff) return "";
    return window.location.origin + window.location.pathname + "#c=" + encodeShare(values, seed);
  }, [values, seed]);

  return { groups, values, setValue, applyValues, reset, toParams, shareLink };
}

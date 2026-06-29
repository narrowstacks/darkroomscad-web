"use client";
import { useMemo, useState, useCallback } from "react";
import { CARRIER_UI } from "@/config/carrier-ui";
import { resolveFormModel } from "@/lib/form/form-model";
import { initialValues, toRenderParams } from "@/lib/form/form-state";
import schema from "../../generated/param-schema.json";
import type { ParamSchema } from "@/lib/params/types";
import type { FormValue } from "@/lib/form/types";
import type { RenderParams } from "@/lib/openscad/types";

export function useCarrierForm() {
  const groups = useMemo(() => resolveFormModel(schema as ParamSchema, CARRIER_UI), []);
  const [values, setValues] = useState<Record<string, FormValue>>(() => {
    const seed = initialValues(groups);
    const ff = (schema as ParamSchema).params.find((p) => p.name === "Film_Format");
    return {
      ...seed,
      Film_Format: (ff?.default as FormValue) ?? "35mm",
    };
  });
  const setValue = useCallback((param: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [param]: value }));
  }, []);
  const toParams = useCallback(
    (system: Record<string, FormValue>): RenderParams =>
      toRenderParams(groups, values, { Film_Format: values.Film_Format, ...system }),
    [groups, values],
  );
  return { groups, values, setValue, toParams };
}

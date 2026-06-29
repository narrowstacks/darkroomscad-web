import type { FormValue, ResolvedField, ResolvedGroup } from "./types";
import type { RenderParams } from "../openscad/types";

export function initialValues(groups: ResolvedGroup[]): Record<string, FormValue> {
  const out: Record<string, FormValue> = {};
  for (const g of groups) for (const f of g.fields) out[f.param] = f.default;
  return out;
}

export function visibleFields(
  groups: ResolvedGroup[],
  values: Record<string, FormValue>,
): ResolvedField[] {
  const out: ResolvedField[] = [];
  for (const g of groups) {
    for (const f of g.fields) {
      if (!f.visibleWhen || f.visibleWhen(values)) out.push(f);
    }
  }
  return out;
}

export function toRenderParams(
  groups: ResolvedGroup[],
  values: Record<string, FormValue>,
  system: Record<string, FormValue>,
): RenderParams {
  const params: RenderParams = {};
  for (const f of visibleFields(groups, values)) params[f.param] = values[f.param];
  return { ...params, ...system };
}

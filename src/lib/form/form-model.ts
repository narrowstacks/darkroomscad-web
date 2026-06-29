import type { ParamSchema, Param, ParamType } from "../params/types";
import { BUNDLED_FONTS, DEFAULT_FONT_FAMILY } from "../../config/fonts";
import type { ControlKind, FormValue, GroupConfig, ResolvedField, ResolvedGroup } from "./types";

export const SYSTEM_DEFAULT_OVERRIDES: Record<string, FormValue> = {
  Fontface: DEFAULT_FONT_FAMILY,
};

function controlForType(type: ParamType): ControlKind {
  switch (type) {
    case "enum": return "select";
    case "number": return "number";
    case "boolean": return "toggle";
    default: return "text";
  }
}

function fontOptions(): { value: string; label: string }[] {
  return BUNDLED_FONTS.map((f) => ({ value: f.family, label: f.family }));
}

export function resolveFormModel(schema: ParamSchema, ui: GroupConfig[]): ResolvedGroup[] {
  const byName = new Map<string, Param>(schema.params.map((p) => [p.name, p]));
  return ui.map((group) => ({
    title: group.title,
    fields: group.fields.map((fc): ResolvedField => {
      const p = byName.get(fc.param);
      if (!p) throw new Error(`carrier-ui references unknown param "${fc.param}"`);
      const control = fc.control ?? controlForType(p.type);
      const options = fc.optionsFrom === "fonts" ? fontOptions() : p.options;
      const override = SYSTEM_DEFAULT_OVERRIDES[fc.param];
      return {
        param: fc.param,
        label: fc.label,
        help: fc.help,
        advanced: fc.advanced ?? false,
        control,
        options,
        min: p.min,
        max: p.max,
        step: p.step,
        default: override !== undefined ? override : p.default,
        visibleWhen: fc.visibleWhen,
      };
    }),
  }));
}

export function validateOverlay(schema: ParamSchema, ui: GroupConfig[]): string[] {
  const names = new Set(schema.params.map((p) => p.name));
  const errors: string[] = [];
  for (const group of ui) {
    for (const field of group.fields) {
      if (!names.has(field.param)) {
        errors.push(`carrier-ui group "${group.title}" references unknown param "${field.param}"`);
      }
    }
  }
  return errors;
}

import { describe, it, expect } from "vitest";
import { resolveFormModel, validateOverlay } from "./form-model";
import type { GroupConfig } from "./types";
import type { ParamSchema } from "../params/types";

const schema: ParamSchema = {
  params: [
    { name: "Carrier_Type", section: "Carrier Type", type: "enum", default: "omega-d", hidden: false,
      options: [{ value: "omega-d", label: "omega-d" }, { value: "beseler-23c", label: "beseler-23c" }] },
    { name: "Font_Size", section: "x", type: "number", default: 10, min: 6, max: 40, step: 0.5, hidden: false },
    { name: "Owner_Name", section: "x", type: "string", default: "NAME", hidden: false },
    { name: "Fontface", section: "x", type: "string", default: "Lucida Console", hidden: false },
    { name: "Alignment_Board", section: "x", type: "boolean", default: true, hidden: false },
  ],
};

describe("resolveFormModel", () => {
  it("merges schema type/default/options/range into resolved fields and derives control kind", () => {
    const ui: GroupConfig[] = [{ title: "Main", fields: [
      { param: "Carrier_Type", label: "Enlarger" },
      { param: "Font_Size", label: "Text size" },
      { param: "Owner_Name", label: "Your name" },
      { param: "Alignment_Board", label: "Alignment board" },
    ] }];
    const [group] = resolveFormModel(schema, ui);
    expect(group.title).toBe("Main");
    const byParam = Object.fromEntries(group.fields.map((f) => [f.param, f]));
    expect(byParam.Carrier_Type).toMatchObject({ control: "select", default: "omega-d" });
    expect(byParam.Carrier_Type.options).toHaveLength(2);
    expect(byParam.Font_Size).toMatchObject({ control: "number", default: 10, min: 6, max: 40, step: 0.5 });
    expect(byParam.Owner_Name).toMatchObject({ control: "text", default: "NAME" });
    expect(byParam.Alignment_Board).toMatchObject({ control: "toggle", default: true });
  });

  it("sources Fontface options from BUNDLED_FONTS and applies the default override", () => {
    const ui: GroupConfig[] = [{ title: "Text", fields: [
      { param: "Fontface", label: "Font", control: "select", optionsFrom: "fonts" },
    ] }];
    const [group] = resolveFormModel(schema, ui);
    const f = group.fields[0];
    expect(f.control).toBe("select");
    expect(f.options?.length).toBeGreaterThanOrEqual(1);
    expect(f.options?.map((o) => o.value)).toContain("Liberation Mono");
    // Proprietary schema default is overridden to a bundled face
    expect(f.default).toBe("Liberation Mono");
  });

  it("carries advanced flag and visibleWhen through", () => {
    const ui: GroupConfig[] = [{ title: "Adv", fields: [
      { param: "Font_Size", label: "Size", advanced: true, visibleWhen: (v) => v.Alignment_Board === true },
    ] }];
    const f = resolveFormModel(schema, ui)[0].fields[0];
    expect(f.advanced).toBe(true);
    expect(f.visibleWhen?.({ Alignment_Board: true })).toBe(true);
    expect(f.visibleWhen?.({ Alignment_Board: false })).toBe(false);
  });

  it("throws when a field references a param absent from the schema", () => {
    const ui: GroupConfig[] = [{ title: "X", fields: [{ param: "Ghost_Param", label: "x" }] }];
    expect(() => resolveFormModel(schema, ui)).toThrow(/Ghost_Param/);
  });

  it("prefers overlay min/max/step over schema values", () => {
    // Schema has Font_Size min=6, max=40, step=0.5; overlay overrides to min=4, max=50, step=1
    const ui: GroupConfig[] = [{ title: "Text", fields: [
      { param: "Font_Size", label: "Font size", control: "slider", min: 4, max: 50, step: 1 },
    ] }];
    const f = resolveFormModel(schema, ui)[0].fields[0];
    expect(f.min).toBe(4);
    expect(f.max).toBe(50);
    expect(f.step).toBe(1);
  });

  it("treats a 0 overlay bound as a real override (?? not ||)", () => {
    // Font_Size schema min is 6; an overlay min of 0 must win — `0 ?? 6` is 0,
    // whereas a `||` bug would wrongly return 6. Guards the resolver semantics.
    const ui: GroupConfig[] = [{ title: "Text", fields: [
      { param: "Font_Size", label: "Font size", control: "slider", min: 0 },
    ] }];
    const f = resolveFormModel(schema, ui)[0].fields[0];
    expect(f.min).toBe(0);
  });
});

describe("validateOverlay", () => {
  it("returns no errors when every referenced param exists", () => {
    const ui: GroupConfig[] = [{ title: "M", fields: [{ param: "Carrier_Type", label: "x" }] }];
    expect(validateOverlay(schema, ui)).toEqual([]);
  });

  it("flags overlay fields referencing a param missing from the schema", () => {
    const ui: GroupConfig[] = [{ title: "M", fields: [{ param: "Nonexistent_Param", label: "x" }] }];
    const errors = validateOverlay(schema, ui);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Nonexistent_Param");
  });
});

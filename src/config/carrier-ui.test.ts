import { describe, it, expect } from "vitest";
import { CARRIER_UI } from "./carrier-ui";
import { validateOverlay, resolveFormModel } from "../lib/form/form-model";
import schema from "../../generated/param-schema.json";
import type { ParamSchema } from "../lib/params/types";

describe("carrier-ui overlay vs generated schema", () => {
  const s = schema as ParamSchema;

  it("references only params that exist in the generated schema", () => {
    expect(validateOverlay(s, CARRIER_UI)).toEqual([]);
  });

  it("resolves and assigns the intended control kinds", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const byParam = Object.fromEntries(groups.flatMap((g) => g.fields).map((f) => [f.param, f]));
    expect(byParam.Carrier_Type.control).toBe("cards");
    expect(byParam.Orientation.control).toBe("segmented");
    expect(byParam.Enable_Owner_Name_Etch.control).toBe("switch");
    expect(byParam.Font_Size.control).toBe("slider");
  });

  it("does not include Film_Format (handled by the bespoke picker)", () => {
    const params = CARRIER_UI.flatMap((g) => g.fields).map((f) => f.param);
    expect(params).not.toContain("Film_Format");
  });

  it("hides the not-yet-implemented beseler-45 carrier from the picker", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const carrier = groups.flatMap((g) => g.fields).find((f) => f.param === "Carrier_Type")!;
    const values = (carrier.options ?? []).map((o) => String(o.value));
    expect(values).not.toContain("beseler-45");
    // The implemented carriers are still offered.
    expect(values).toContain("omega-d");
    expect(values).toContain("beseler-23c");
  });

  it("resolves overlay-provided slider ranges (Font_Size: min=4, max=40, step=0.5)", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const byParam = Object.fromEntries(groups.flatMap((g) => g.fields).map((f) => [f.param, f]));
    expect(byParam.Font_Size.min).toBe(4);
    expect(byParam.Font_Size.max).toBe(40);
    expect(byParam.Font_Size.step).toBe(0.5);
  });

  it("resolves offset sliders with negative min (no clamping to 0)", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const byParam = Object.fromEntries(groups.flatMap((g) => g.fields).map((f) => [f.param, f]));
    expect(byParam.Owner_Text_X_Offset.min).toBe(-15);
    expect(byParam.Owner_Text_Y_Offset.min).toBe(-15);
    expect(byParam.Type_Text_X_Offset.min).toBe(-15);
    expect(byParam.Type_Text_Y_Offset.min).toBe(-15);
    expect(byParam.Peg_Gap.min).toBe(-2);
    expect(byParam.Adjust_Film_Width.min).toBe(-3);
    expect(byParam.Adjust_Film_Height.min).toBe(-3);
  });
});

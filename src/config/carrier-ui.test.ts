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

  it("Frame_Count is a 1–4 segmented control shown only for formats with a frame pitch", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const f = groups.flatMap((g) => g.fields).find((x) => x.param === "Frame_Count")!;
    expect(f.control).toBe("segmented");
    expect((f.options ?? []).map((o) => o.value)).toEqual([1, 2, 3, 4]);
    expect(f.default).toBe(1);
    expect(f.visibleWhen!({ Film_Format: "35mm" })).toBe(true);
    expect(f.visibleWhen!({ Film_Format: "6x6 filed" })).toBe(true);
    expect(f.visibleWhen!({ Film_Format: "4x5" })).toBe(false);
    expect(f.visibleWhen!({ Film_Format: "custom" })).toBe(false);
  });

  it("omega-d-glass: locks part/flip/board (the SCAD forces them) with a 'Locked' hint, hides pegs, shows the glass group", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const byParam = Object.fromEntries(groups.flatMap((g) => g.fields).map((f) => [f.param, f]));
    const glass = { Carrier_Type: "omega-d-glass", Glass_Notch_Corner: "handle-lower" };
    const omega = { Carrier_Type: "omega-d" };
    const help = (p: string, v: Record<string, string>) => {
      const h = byParam[p].help;
      return typeof h === "function" ? h(v) : h;
    };
    // Segmented controls lock by disabling every option; switches by disabledWhen.
    for (const p of ["Top_or_Bottom", "Alignment_Board_Type"]) {
      expect(byParam[p].optionDisabledWhen!("x", glass), p).toBe(true);
      expect(byParam[p].optionDisabledWhen!("x", omega), p).toBe(false);
      expect(help(p, glass)).toMatch(/^Locked/);
      expect(help(p, omega)).not.toMatch(/^Locked/);
    }
    for (const p of ["Alignment_Board", "Flip_Bottom_For_Printing"]) {
      expect(byParam[p].disabledWhen!(glass), p).toBe(true);
      expect(byParam[p].disabledWhen!(omega), p).toBe(false);
      expect(help(p, glass)).toMatch(/^Locked/);
      expect(help(p, omega) ?? "").not.toMatch(/^Locked/);
    }
    expect(byParam.Printed_or_Heat_Set_Pegs.visibleWhen!(glass)).toBe(false);
    expect(byParam.Printed_or_Heat_Set_Pegs.visibleWhen!(omega)).toBe(true);
    for (const p of ["Glass_Plate_Width", "Glass_Plate_Length", "Glass_Plate_Thickness", "Glass_Notch_Corner", "Glass_Notch_Diameter"]) {
      expect(byParam[p].visibleWhen!(glass), p).toBe(true);
      expect(byParam[p].visibleWhen!(omega), p).toBe(false);
    }
    // Notch sizing disappears when there is no notch.
    expect(byParam.Glass_Notch_Diameter.visibleWhen!({ ...glass, Glass_Notch_Corner: "none" })).toBe(false);
    expect((byParam.Glass_Notch_Corner.options ?? []).map((o) => o.value))
      .toEqual(["handle-lower", "handle-upper", "far-lower", "far-upper", "none"]);
    // Glass-plate group collapses entirely for other carriers (nothing visible).
    const glassGroup = groups.find((g) => g.title === "Glass plate")!;
    expect(glassGroup.fields.every((f) => f.visibleWhen!(omega) === false)).toBe(true);
  });

  it("offers the glass carrier in the picker, under its own 'Special' section", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const carrier = groups.flatMap((g) => g.fields).find((f) => f.param === "Carrier_Type")!;
    expect((carrier.options ?? []).map((o) => String(o.value))).toContain("omega-d-glass");
    expect(carrier.optionSections).toEqual([{ title: "Special", values: ["omega-d-glass"] }]);
  });

  it("does not include Film_Format (handled by the bespoke picker)", () => {
    const params = CARRIER_UI.flatMap((g) => g.fields).map((f) => f.param);
    expect(params).not.toContain("Film_Format");
  });

  it("offers all implemented carriers in the picker, including beseler-45", () => {
    const groups = resolveFormModel(s, CARRIER_UI);
    const carrier = groups.flatMap((g) => g.fields).find((f) => f.param === "Carrier_Type")!;
    const values = (carrier.options ?? []).map((o) => String(o.value));
    expect(values).toContain("beseler-45");
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

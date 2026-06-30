import { describe, it, expect } from "vitest";
import { zipFileName } from "./zip-name";
import type { RenderParams } from "../openscad/types";

const baseForm: RenderParams = {
  Carrier_Type: "omega-d",
  Film_Format: "35mm filed",
  Enable_Owner_Name_Etch: true,
  Owner_Name: "AARON",
};

describe("zipFileName", () => {
  it("preset + name: both prefix the carrier/format tail", () => {
    expect(zipFileName(baseForm, "MyPreset")).toBe("MyPreset_AARON_omega-d_35mm-filed.zip");
  });

  it("name only: no preset segment", () => {
    expect(zipFileName(baseForm)).toBe("AARON_omega-d_35mm-filed.zip");
  });

  it("preset only: an unchanged preset with no name", () => {
    const form = { ...baseForm, Owner_Name: "" };
    expect(zipFileName(form, "MyPreset")).toBe("MyPreset_omega-d_35mm-filed.zip");
  });

  it("neither preset nor name: just carrier/format", () => {
    const form = { ...baseForm, Owner_Name: "" };
    expect(zipFileName(form)).toBe("omega-d_35mm-filed.zip");
  });

  it("custom size: uses the film dimensions instead of a format name", () => {
    const form: RenderParams = {
      Carrier_Type: "omega-d",
      Film_Format: "custom",
      Custom_Film_Width: 60,
      Custom_Film_Height: 45,
    };
    expect(zipFileName(form)).toBe("omega-d_60mmX45mm.zip");
  });

  it("custom size with preset + name", () => {
    const form: RenderParams = {
      Carrier_Type: "omega-d",
      Film_Format: "custom",
      Custom_Film_Width: 60,
      Custom_Film_Height: 45,
      Enable_Owner_Name_Etch: true,
      Owner_Name: "AARON",
    };
    expect(zipFileName(form, "MyPreset")).toBe("MyPreset_AARON_omega-d_60mmX45mm.zip");
  });

  it("ignores the name field when the etch toggle is off", () => {
    const form = { ...baseForm, Enable_Owner_Name_Etch: false };
    expect(zipFileName(form)).toBe("omega-d_35mm-filed.zip");
  });

  it("sanitizes free text in preset and owner names", () => {
    const form = { ...baseForm, Owner_Name: "John / Jane" };
    expect(zipFileName(form, "Beach Trip!")).toBe("Beach-Trip_John-Jane_omega-d_35mm-filed.zip");
  });
});

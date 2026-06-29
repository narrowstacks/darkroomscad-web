import { describe, it, expect } from "vitest";
import { enumerateParts } from "./part-enumeration";
import type { RenderParams } from "../openscad/types";

const baseForm: RenderParams = {
  Carrier_Type: "omega-d", Film_Format: "35mm", Orientation: "vertical",
  Enable_Owner_Name_Etch: true, Enable_Type_Name_Etch: true,
};

describe("enumerateParts", () => {
  it("single-material: one All part per half (top + bottom), final quality", () => {
    const jobs = enumerateParts({ ...baseForm, Text_As_Separate_Parts: false });
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.params.Top_or_Bottom)).toEqual(["top", "bottom"]);
    for (const j of jobs) {
      expect(j.params._WhichPart).toBe("All");
      expect(j.params.Render_Quality).toBe("final");
    }
    expect(jobs[0].name).toBe("omega-d_35mm_vertical_top.stl");
  });

  it("multi-material with both etches: Base + OwnerText + TypeText per half (6 jobs)", () => {
    const jobs = enumerateParts({ ...baseForm, Text_As_Separate_Parts: true });
    expect(jobs).toHaveLength(6);
    const whichParts = jobs.filter((j) => j.params.Top_or_Bottom === "top").map((j) => j.params._WhichPart);
    expect(whichParts).toEqual(["Base", "OwnerText", "TypeText"]);
    expect(jobs.find((j) => j.params._WhichPart === "OwnerText")!.name).toContain("owner-text");
  });

  it("multi-material with only the name etch: Base + OwnerText per half (4 jobs, no TypeText)", () => {
    const jobs = enumerateParts({
      ...baseForm, Text_As_Separate_Parts: true,
      Enable_Owner_Name_Etch: true, Enable_Type_Name_Etch: false,
    });
    expect(jobs).toHaveLength(4);
    expect(jobs.some((j) => j.params._WhichPart === "TypeText")).toBe(false);
  });

  it("encodes carrier/format/orientation/part in the filename, spaces dashed", () => {
    const jobs = enumerateParts({ ...baseForm, Film_Format: "6x6 filed", Text_As_Separate_Parts: false });
    expect(jobs[0].name).toBe("omega-d_6x6-filed_vertical_top.stl");
  });
});

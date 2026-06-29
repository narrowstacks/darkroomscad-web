import { describe, it, expect } from "vitest";
import { buildParamSetJson } from "./params";

describe("buildParamSetJson", () => {
  it("serializes a customizer parameter set OpenSCAD can read", () => {
    const json = buildParamSetJson(
      { Owner_Name: "AARON", Film_Format: "35mm", Alignment_Board: true, Font_Size: 10 },
      "web",
    );
    const parsed = JSON.parse(json);
    expect(parsed.fileFormatVersion).toBe("1");
    // OpenSCAD parameter sets store every value as a string.
    expect(parsed.parameterSets.web).toEqual({
      Owner_Name: "AARON",
      Film_Format: "35mm",
      Alignment_Board: "true",
      Font_Size: "10",
    });
  });
});

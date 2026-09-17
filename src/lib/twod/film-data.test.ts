import { describe, it, expect } from "vitest";
import { FILM_FORMATS, isFiledFormat, filmTypeName, filmFramePitch, effectiveFrameCount } from "./film-data";

describe("film-data", () => {
  it("matches the SCAD film table for key formats", () => {
    expect(FILM_FORMATS["35mm"]).toEqual({ height: 36, width: 24, pegDistance: 37.5, typeName: "35MM", framePitch: 38 });
    expect(FILM_FORMATS["6x6"]).toEqual({ height: 56, width: 56, pegDistance: 64, typeName: "6x6", framePitch: 59 });
    expect(FILM_FORMATS["4x5"]).toEqual({ height: 120, width: 95, pegDistance: 104.1, typeName: "4X5", framePitch: 0 });
    expect(FILM_FORMATS["6x9 filed"]).toEqual({ height: 86, width: 58, pegDistance: 64, typeName: "F6x9", framePitch: 87 });
    expect(FILM_FORMATS["half frame filed"]).toEqual({ height: 21, width: 28, pegDistance: 37.5, typeName: "FILEDHALF", framePitch: 19 });
  });

  it("identifies filed formats", () => {
    expect(isFiledFormat("6x6 filed")).toBe(true);
    expect(isFiledFormat("35mm filed")).toBe(true);
    expect(isFiledFormat("half frame filed")).toBe(true);
    expect(isFiledFormat("half frame")).toBe(false);
    expect(isFiledFormat("6x6")).toBe(false);
  });

  it("resolves type names incl. custom fallback", () => {
    expect(filmTypeName("35mm filed")).toBe("FILED35");
    expect(filmTypeName("35mm full")).toBe("35mm full"); // legacy value: no entry, falls back to the raw name
    expect(filmTypeName("custom")).toBe("CUSTOM");
  });

  it("frame pitch: filed shares the unfiled pitch; 4x5/custom/unknown have none", () => {
    expect(filmFramePitch("35mm filed")).toBe(38);
    expect(filmFramePitch("6x4.5 filed")).toBe(44.5);
    expect(filmFramePitch("4x5")).toBe(0);
    expect(filmFramePitch("custom")).toBe(0);
    expect(filmFramePitch("6x12")).toBe(0);
  });

  it("effective frame count collapses to 1 where frames don't apply (mirrors get_effective_frame_count)", () => {
    expect(effectiveFrameCount("35mm", 2)).toBe(2);
    expect(effectiveFrameCount("35mm", 1)).toBe(1);
    expect(effectiveFrameCount("4x5", 3)).toBe(1);
    expect(effectiveFrameCount("custom", 2)).toBe(1);
    expect(effectiveFrameCount("35mm", 0)).toBe(1);
  });

  it("type name gets an X<n> suffix only for multi-frame openings", () => {
    expect(filmTypeName("35mm", 2)).toBe("35MM X2");
    expect(filmTypeName("6x6 filed", 3)).toBe("F6x6 X3");
    expect(filmTypeName("35mm", 1)).toBe("35MM");
    expect(filmTypeName("4x5", 2)).toBe("4X5");
    expect(filmTypeName("custom", 2)).toBe("CUSTOM");
  });
});

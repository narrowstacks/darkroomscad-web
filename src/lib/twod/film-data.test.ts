import { describe, it, expect } from "vitest";
import { FILM_FORMATS, isFiledFormat, filmTypeName } from "./film-data";

describe("film-data", () => {
  it("matches the SCAD film table for key formats", () => {
    expect(FILM_FORMATS["35mm"]).toEqual({ height: 37, width: 24, pegDistance: 37, typeName: "35MM" });
    expect(FILM_FORMATS["6x6"]).toEqual({ height: 56, width: 56, pegDistance: 62, typeName: "6x6" });
    expect(FILM_FORMATS["4x5"]).toEqual({ height: 120, width: 95, pegDistance: 102, typeName: "4X5" });
    expect(FILM_FORMATS["6x9 filed"]).toEqual({ height: 86, width: 58, pegDistance: 62, typeName: "F6x9" });
  });

  it("identifies filed formats", () => {
    expect(isFiledFormat("6x6 filed")).toBe(true);
    expect(isFiledFormat("35mm filed")).toBe(true);
    expect(isFiledFormat("6x6")).toBe(false);
  });

  it("resolves type names incl. custom fallback", () => {
    expect(filmTypeName("35mm full")).toBe("FULL35");
    expect(filmTypeName("custom")).toBe("CUSTOM");
  });
});

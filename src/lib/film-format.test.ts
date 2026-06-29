import { describe, it, expect } from "vitest";
import { FORMAT_CHIPS, toFilmFormatValue, fromFilmFormatValue } from "./film-format";
import schema from "../../generated/param-schema.json";
import type { ParamSchema } from "./params/types";

describe("film-format mapping", () => {
  it("round-trips base + filed through value", () => {
    expect(toFilmFormatValue("6x6", false)).toBe("6x6");
    expect(toFilmFormatValue("6x6", true)).toBe("6x6 filed");
    expect(fromFilmFormatValue("6x6 filed")).toEqual({ base: "6x6", filed: true });
    expect(fromFilmFormatValue("6x6")).toEqual({ base: "6x6", filed: false });
  });

  it("never marks a non-filed base as filed", () => {
    // 4x5 has no filed variant in the schema
    expect(toFilmFormatValue("4x5", true)).toBe("4x5");
  });

  it("every producible value exists in the schema's Film_Format enum", () => {
    const s = schema as ParamSchema;
    const filmFormat = s.params.find((p) => p.name === "Film_Format");
    const allowed = new Set((filmFormat?.options ?? []).map((o) => String(o.value)));
    for (const chip of FORMAT_CHIPS) {
      expect(allowed.has(toFilmFormatValue(chip.base, false))).toBe(true);
      if (chip.hasFiled) expect(allowed.has(toFilmFormatValue(chip.base, true))).toBe(true);
    }
  });
});

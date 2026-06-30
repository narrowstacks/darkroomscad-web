import { describe, it, expect } from "vitest";
import { parseStoredValues, serializeValues } from "./config-store";

const known = new Set(["Carrier_Type", "Film_Format", "Font_Size", "Alignment_Board"]);

describe("parseStoredValues", () => {
  it("returns {} for null or empty input", () => {
    expect(parseStoredValues(null, known)).toEqual({});
    expect(parseStoredValues("", known)).toEqual({});
  });

  it("returns {} for corrupt JSON or non-objects", () => {
    expect(parseStoredValues("{not json", known)).toEqual({});
    expect(parseStoredValues("42", known)).toEqual({});
    expect(parseStoredValues("[1,2]", known)).toEqual({});
  });

  it("keeps only known keys with primitive values", () => {
    const raw = JSON.stringify({
      Carrier_Type: "omega-d", Font_Size: 12, Alignment_Board: false,
      Unknown_Param: "drop me", // stale/unknown key
      Nested: { a: 1 },          // non-primitive value
    });
    expect(parseStoredValues(raw, known)).toEqual({
      Carrier_Type: "omega-d", Font_Size: 12, Alignment_Board: false,
    });
  });

  it("round-trips through serialize", () => {
    const values = { Carrier_Type: "beseler-23c", Film_Format: "6x6", Font_Size: 8 };
    expect(parseStoredValues(serializeValues(values), known)).toEqual(values);
  });
});

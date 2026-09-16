import { describe, it, expect } from "vitest";
import { presetFileJson } from "./preset-json";
import { parsePresets } from "../storage/presets-store";

describe("presetFileJson", () => {
  it("round-trips through the presets importer", () => {
    const values = { Carrier_Type: "omega-d", Film_Format: "35mm", Alignment_Board: true, Peg_Count: 4 };
    const back = parsePresets(presetFileJson("My carrier", values));
    expect(back).toHaveLength(1);
    expect(back[0].name).toBe("My carrier");
    expect(back[0].values).toEqual(values);
  });
});

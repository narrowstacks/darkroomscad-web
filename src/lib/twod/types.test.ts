import { describe, it, expect } from "vitest";
import { parseConfig } from "./types";

describe("parseConfig", () => {
  it("maps raw form values into a typed config with sane defaults", () => {
    const c = parseConfig({
      Carrier_Type: "omega-d",
      Orientation: "vertical",
      Top_or_Bottom: "bottom",
      Film_Format: "35mm",
      Printed_or_Heat_Set_Pegs: "heat_set",
      Peg_Gap: 0,
      Alignment_Board: true,
      Alignment_Board_Type: "omega",
      Enable_Owner_Name_Etch: true,
      Owner_Name: "ADA",
      Enable_Type_Name_Etch: true,
      Type_Name: "Carrier Type",
      Custom_Type_Name: "X",
      Fontface: "Lucida Console",
      Font_Size: 10,
      Owner_Text_X_Offset: 2,
      Owner_Text_Y_Offset: 3,
    });
    expect(c.carrierType).toBe("omega-d");
    expect(c.topOrBottom).toBe("bottom");
    expect(c.pegStyle).toBe("heat_set");
    expect(c.alignmentBoard).toBe(true);
    expect(c.ownerName).toBe("ADA");
    expect(c.ownerTextOffset).toEqual([2, 3]);
    expect(c.fontSize).toBe(10);
  });

  it("falls back to defaults for missing keys", () => {
    const c = parseConfig({});
    expect(c.carrierType).toBe("omega-d");
    expect(c.orientation).toBe("vertical");
    expect(c.pegStyle).toBe("heat_set");
    expect(c.typeTextOffset).toEqual([0, 0]);
  });
});

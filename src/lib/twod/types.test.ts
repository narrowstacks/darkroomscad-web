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
    expect(c.frameCount).toBe(1);
  });

  it("reads the glass-plate params with carrier.scad defaults", () => {
    expect(parseConfig({}).glass).toEqual({
      plateWidth: 101, plateLength: 126, plateThickness: 2, sidePlay: 0.5, depthPlay: 0.2,
      notchDiameter: 16, notchCorner: "handle-lower", notchFloor: 0.6, notchReach: 2.5,
    });
    expect(parseConfig({ Glass_Notch_Corner: "far-upper", Glass_Plate_Width: 100 }).glass)
      .toMatchObject({ notchCorner: "far-upper", plateWidth: 100 });
  });

  it("reads Frame_Count (the schema enum carries numbers; strings from a share link coerce)", () => {
    expect(parseConfig({ Frame_Count: 2 }).frameCount).toBe(2);
    expect(parseConfig({ Frame_Count: "3" }).frameCount).toBe(3);
  });

  it("falls back to defaults for missing keys", () => {
    const c = parseConfig({});
    expect(c.carrierType).toBe("omega-d");
    expect(c.orientation).toBe("vertical");
    expect(c.pegStyle).toBe("heat_set");
    expect(c.typeTextOffset).toEqual([0, 0]);
    expect(c.heatSetScrewSize).toBe("M2");
    expect(c.heatSetThreadHoleAdjust).toBe(0);
    expect(c.heatSetHeadHoleAdjust).toBe(0);
  });

  it("reads the heat-set screw settings (numbers from a share link coerce)", () => {
    const c = parseConfig({ Heat_Set_Screw_Size: "M3", Heat_Set_Thread_Hole_Adjust: "0.2", Heat_Set_Head_Hole_Adjust: -0.1 });
    expect(c.heatSetScrewSize).toBe("M3");
    expect(c.heatSetThreadHoleAdjust).toBe(0.2);
    expect(c.heatSetHeadHoleAdjust).toBe(-0.1);
  });
});

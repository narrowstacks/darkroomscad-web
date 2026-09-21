import { describe, it, expect } from "vitest";
import { parsePathPolygons, pointInPolygons, openingFitIssues, BODY_WALL_MARGIN } from "./opening-fit";
import { openingDimensions, boardTypeOutlineKey } from "./geometry";
import type { TwoDConfig } from "./types";
import { CARRIER_OUTLINES } from "@/lib/outline/outlines";
import { BOARD_OUTLINES } from "@/lib/outline/board-outlines";

const square = (half: number) =>
  `M ${-half},${-half} L ${half},${-half} L ${half},${half} L ${-half},${half} z`;

describe("parsePathPolygons / pointInPolygons", () => {
  it("parses M/L/z subpaths and applies even-odd (a hole reads as outside)", () => {
    const ring = parsePathPolygons(`${square(10)} ${square(4)}`);
    expect(ring).toHaveLength(2);
    expect(pointInPolygons(ring, 7, 0)).toBe(true);   // on the ring
    expect(pointInPolygons(ring, 0, 0)).toBe(false);  // in the hole
    expect(pointInPolygons(ring, 12, 0)).toBe(false); // outside
  });
  it("rejects curve commands (the generator only emits polygons)", () => {
    expect(() => parsePathPolygons("M 0,0 C 1,1 2,2 3,3 z")).toThrow();
  });
});

describe("openingFitIssues — synthetic", () => {
  const body = { d: square(50) };
  it("fits when the opening plus wall margin is inside the body", () => {
    expect(openingFitIssues({ w: 90, h: 20 }, body)).toEqual([]);
  });
  it("flags the body when the wall margin is violated", () => {
    const w = 100 - 2 * BODY_WALL_MARGIN + 0.5;
    expect(openingFitIssues({ w, h: 20 }, body)).toEqual(["body"]);
  });
  it("flags the board when the opening lands on board material", () => {
    const board = { d: `${square(40)} ${square(20)}` }; // ring with a 40×40 hole
    expect(openingFitIssues({ w: 30, h: 30 }, body, board)).toEqual([]);
    expect(openingFitIssues({ w: 46, h: 30 }, body, board)).toEqual(["board"]);
  });
  it("catches a board that masks only the corners (cross-shaped cutout)", () => {
    // 120×120 board whose hole is a cross (a 100×20 bar plus a 20×100 bar).
    const crossOutline =
      `${square(60)} M -50,-10 L -10,-10 L -10,-50 L 10,-50 L 10,-10 L 50,-10 L 50,10 L 10,10 L 10,50 L -10,50 L -10,10 L -50,10 z`;
    const board = { d: crossOutline };
    expect(openingFitIssues({ w: 90, h: 18 }, body, board)).toEqual([]);      // inside the wide bar
    expect(openingFitIssues({ w: 30, h: 30 }, body, board)).toEqual(["board"]); // corners hit material
  });
  it("reports nothing without a body outline", () => {
    expect(openingFitIssues({ w: 500, h: 500 }, undefined)).toEqual([]);
  });
});

describe("openingFitIssues — real outlines", () => {
  const base: TwoDConfig = {
    carrierType: "omega-d", orientation: "vertical", topOrBottom: "bottom",
    filmFormat: "35mm", frameCount: 1, customFilmWidth: 37, customFilmHeight: 37,
    customOpeningWidth: 24, customOpeningHeight: 36, pegStyle: "heat_set", heatSetScrewSize: "M2", heatSetThreadHoleAdjust: 0, heatSetHeadHoleAdjust: 0,
    pegGap: 0, adjustFilmWidth: 0, adjustFilmHeight: 0, alignmentBoard: true,
    alignmentBoardType: "omega", enableOwnerEtch: false, ownerName: "",
    enableTypeEtch: false, typeNameSource: "Carrier Type", customTypeName: "",
    fontFace: "Lucida Console", fontSize: 10, ownerTextOffset: [0, 0], typeTextOffset: [0, 0],
    glass: {
      plateWidth: 101, plateLength: 126, plateThickness: 2, sidePlay: 0.5, depthPlay: 0.2,
      notchDiameter: 16, notchCorner: "handle-lower", notchFloor: 0.6, notchReach: 2.5,
    },
  };
  const issues = (c: TwoDConfig) => {
    const { openingHeight, openingWidth } = openingDimensions(c);
    const key = boardTypeOutlineKey(c);
    return openingFitIssues({ w: openingHeight, h: openingWidth }, CARRIER_OUTLINES[c.carrierType], key ? BOARD_OUTLINES[key] : undefined);
  };

  it("every single-frame format fits its supported carriers with the default board", () => {
    for (const format of ["35mm", "35mm filed", "half frame", "6x4.5", "6x6 filed", "6x7", "6x9 filed"]) {
      for (const orientation of ["vertical", "horizontal"] as const) {
        expect(issues({ ...base, filmFormat: format, orientation }), `${format} ${orientation}`).toEqual([]);
      }
    }
    expect(issues({ ...base, filmFormat: "4x5" })).toEqual([]);
  });

  it("omega-d: 3 × 35mm fits both ways; 4 × 35mm (150mm) fits the body but is masked by the 119mm board cutout", () => {
    expect(issues({ ...base, frameCount: 3 })).toEqual([]);
    expect(issues({ ...base, frameCount: 3, orientation: "horizontal" })).toEqual([]);
    expect(issues({ ...base, frameCount: 4 })).toEqual(["board"]);
  });

  it("omega-d: 3 × 6x6 (174mm) runs past the body and the board", () => {
    expect(issues({ ...base, filmFormat: "6x6", frameCount: 3 })).toEqual(["body", "board"]);
  });

  it("omega board: 2 × 6x6 (115mm) clears the 119mm tall box vertically but is masked by the 113mm wide box horizontally", () => {
    expect(issues({ ...base, filmFormat: "6x6", frameCount: 2 })).toEqual([]);
    expect(issues({ ...base, filmFormat: "6x6", frameCount: 2, orientation: "horizontal" })).toEqual(["board"]);
  });

  it("beseler-45 (no board): 2 × 6x9 (171mm) fits its 210mm disc", () => {
    expect(issues({ ...base, carrierType: "beseler-45", filmFormat: "6x9", frameCount: 2 })).toEqual([]);
  });

  it("beseler-23c: 3 × 6x6 (174mm) runs past the 160mm disc", () => {
    expect(issues({ ...base, carrierType: "beseler-23c", alignmentBoardType: "beseler-23c", filmFormat: "6x6", frameCount: 3 }))
      .toContain("body");
  });
});

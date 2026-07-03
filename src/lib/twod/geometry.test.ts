import { describe, it, expect } from "vitest";
import { openingDimensions, pegPositions, pegRadiusAndKind, screwFootprint, directionalArrow, textPlacements, buildScene } from "./geometry";
import type { TwoDConfig } from "./types";

const base: TwoDConfig = {
  carrierType: "omega-d", orientation: "vertical", topOrBottom: "bottom",
  filmFormat: "35mm", customFilmWidth: 37, customFilmHeight: 37,
  customOpeningWidth: 24, customOpeningHeight: 36, pegStyle: "heat_set",
  pegGap: 0, adjustFilmWidth: 0, adjustFilmHeight: 0, alignmentBoard: false,
  alignmentBoardType: "omega", enableOwnerEtch: false, ownerName: "",
  enableTypeEtch: false, typeNameSource: "Carrier Type", customTypeName: "",
  fontFace: "Lucida Console", fontSize: 10, ownerTextOffset: [0, 0], typeTextOffset: [0, 0],
};

describe("openingDimensions", () => {
  it("35mm vertical → [37 x 24]", () => {
    expect(openingDimensions(base)).toEqual({ openingHeight: 37, openingWidth: 24 });
  });
  it("35mm horizontal swaps to [24 x 37]", () => {
    expect(openingDimensions({ ...base, orientation: "horizontal" }))
      .toEqual({ openingHeight: 24, openingWidth: 37 });
  });
  it("4x5 forces horizontal (long edge along Y) regardless of orientation", () => {
    expect(openingDimensions({ ...base, filmFormat: "4x5", orientation: "vertical" }))
      .toEqual({ openingHeight: 95, openingWidth: 120 });
  });
  it("applies film adjustments", () => {
    expect(openingDimensions({ ...base, adjustFilmHeight: 2, adjustFilmWidth: 1 }))
      .toEqual({ openingHeight: 39, openingWidth: 25 });
  });
  it("custom uses the custom opening dims directly (no orientation/adjust)", () => {
    expect(openingDimensions({ ...base, filmFormat: "custom", customOpeningHeight: 50, customOpeningWidth: 40, adjustFilmHeight: 9 }))
      .toEqual({ openingHeight: 50, openingWidth: 40 });
  });
  it("unknown format falls back to 35mm dimensions", () => {
    expect(openingDimensions({ ...base, filmFormat: "bogus" }))
      .toEqual({ openingHeight: 37, openingWidth: 24 });
  });
});

describe("pegPositions", () => {
  it("35mm vertical", () => {
    expect(pegPositions(base)).toEqual({ x: 14.8, y: 20.3 });
  });
  it("35mm horizontal swaps axes", () => {
    expect(pegPositions({ ...base, orientation: "horizontal" })).toEqual({ x: 20.3, y: 14.8 });
  });
  it("6x6 vertical", () => {
    expect(pegPositions({ ...base, filmFormat: "6x6" })).toEqual({ x: 30.8, y: 32.8 });
  });
  it("filed format uses the reduced internal gap", () => {
    expect(pegPositions({ ...base, filmFormat: "35mm filed" })).toEqual({ x: 16.8, y: 21.3 });
  });
  it("peg gap shifts only the peg-distance axis", () => {
    expect(pegPositions({ ...base, pegGap: 0.5 })).toEqual({ x: 14.8, y: 20.8 });
  });
  it("custom format: dominant axis uses default 37, peg distance uses custom width", () => {
    // SCAD parity: dominant = 37/2+2.8 = 21.3 ; non-dominant = 50/2+2.8-1 = 26.8
    expect(pegPositions({ ...base, filmFormat: "custom", customFilmWidth: 50 }))
      .toEqual({ x: 21.3, y: 26.8 });
  });
});

describe("pegRadiusAndKind", () => {
  it("bottom printed → solid peg r=2.8", () => {
    expect(pegRadiusAndKind({ ...base, topOrBottom: "bottom", pegStyle: "printed" }))
      .toEqual({ r: 2.8, kind: "peg" });
  });
  it("bottom heat-set → hole r=1.05", () => {
    expect(pegRadiusAndKind({ ...base, topOrBottom: "bottom", pegStyle: "heat_set" }))
      .toEqual({ r: 1.05, kind: "hole" });
  });
  it("top printed → hole r=3.05", () => {
    expect(pegRadiusAndKind({ ...base, topOrBottom: "top", pegStyle: "printed" }))
      .toEqual({ r: 3.05, kind: "hole" });
  });
  it("top heat-set → socket hole r=2.15", () => {
    expect(pegRadiusAndKind({ ...base, topOrBottom: "top", pegStyle: "heat_set" }))
      .toEqual({ r: 2.15, kind: "hole" });
  });
});

describe("screwFootprint", () => {
  it("board off + omega type → 4 holes at (±41, ±56.5) r=1", () => {
    const holes = screwFootprint({ ...base, alignmentBoard: false, alignmentBoardType: "omega" });
    expect(holes).toHaveLength(4);
    for (const h of holes) {
      expect(Math.abs(h.cx)).toBe(41);
      expect(Math.abs(h.cy)).toBe(56.5);
      expect(h.r).toBe(1);
    }
  });
  it("none when the board is attached", () => {
    expect(screwFootprint({ ...base, alignmentBoard: true, alignmentBoardType: "omega" })).toEqual([]);
  });
  it("none for the beseler board type", () => {
    expect(screwFootprint({ ...base, alignmentBoard: false, alignmentBoardType: "beseler-23c" })).toEqual([]);
  });
  it("none for non-board carriers (test frame)", () => {
    expect(screwFootprint({ ...base, carrierType: "frameAndPegTest", alignmentBoard: false })).toEqual([]);
  });
  it("board off + lpl-saunders type → 4 holes (same pattern as omega)", () => {
    const holes = screwFootprint({ ...base, alignmentBoard: false, alignmentBoardType: "lpl-saunders" });
    expect(holes).toHaveLength(4);
    for (const h of holes) {
      expect(Math.abs(h.cx)).toBe(41);
      expect(Math.abs(h.cy)).toBe(56.5);
      expect(h.r).toBe(1);
    }
  });
});

describe("directionalArrow", () => {
  it("null for non-square formats", () => {
    expect(directionalArrow(base)).toBeNull();
  });
  it("6x6 vertical → triangle centered below the opening", () => {
    const a = directionalArrow({ ...base, filmFormat: "6x6" });
    expect(a).not.toBeNull();
    expect(a!.points).toHaveLength(3);
    // opening_width = 56 → arrow band centered at y = -(56/2 + 9) = -37
    expect(a!.points).toEqual([[-4, -37], [4, -34.5], [4, -39.5]]);
  });
  it("6x6 horizontal → triangle to the right of the opening", () => {
    const a = directionalArrow({ ...base, filmFormat: "6x6", orientation: "horizontal" });
    expect(a).not.toBeNull();
    // openingWidth=56 → pos=[56/2+9, -10]=[37,-10], rotZ=90
    expect(a!.points).toEqual([[37, -24], [34.5, -16], [39.5, -16]]);
  });
  it("6x6 filed also gets an arrow", () => {
    expect(directionalArrow({ ...base, filmFormat: "6x6 filed" })).not.toBeNull();
  });
});

const stub = () => 10; // fixed measured width

describe("textPlacements", () => {
  it("omega owner+type: rotated 270, centered by the edge-margin formula", () => {
    const ts = textPlacements(
      { ...base, enableOwnerEtch: true, ownerName: "ADA", enableTypeEtch: true },
      stub,
    );
    // x_center = 69.5 - 5 - 10/2 = 59.5 ; center = rotate270(x_base, -90) = (-90, ∓x_center)
    const owner = ts.find((t) => t.value === "ADA")!;
    expect(owner.rotationDeg).toBe(270);
    expect(owner.cx).toBeCloseTo(-90, 6);
    expect(owner.cy).toBeCloseTo(59.5, 6);
    const type = ts.find((t) => t.value === "35MM")!; // Carrier Type → film type name
    expect(type.cx).toBeCloseTo(-90, 6);
    expect(type.cy).toBeCloseTo(-59.5, 6);
  });

  it("applies user offsets before rotation", () => {
    const [owner] = textPlacements(
      { ...base, enableOwnerEtch: true, ownerName: "ADA", ownerTextOffset: [2, 3] },
      stub,
    );
    // px=-59.5+2=-57.5, py=-90+3=-87 → rotate270 = (-87, 57.5)
    expect(owner.cx).toBeCloseTo(-87, 6);
    expect(owner.cy).toBeCloseTo(57.5, 6);
  });

  it("beseler owner sits on the handle (rotation 0); bottom mirrors Y", () => {
    const top = textPlacements(
      { ...base, carrierType: "beseler-23c", alignmentBoardType: "beseler-23c", topOrBottom: "top", enableOwnerEtch: true, ownerName: "ADA" },
      stub,
    )[0];
    expect(top.rotationDeg).toBe(0);
    expect(top.cx).toBeCloseTo(-80, 6);
    expect(top.cy).toBeCloseTo(10.5, 6);
    const bottom = textPlacements(
      { ...base, carrierType: "beseler-23c", alignmentBoardType: "beseler-23c", topOrBottom: "bottom", enableOwnerEtch: true, ownerName: "ADA" },
      stub,
    )[0];
    expect(bottom.cy).toBeCloseTo(-10.5, 6);
  });

  it("uses the custom type label when the source is Custom", () => {
    const [type] = textPlacements(
      { ...base, enableTypeEtch: true, typeNameSource: "Custom", customTypeName: "MINE" },
      stub,
    );
    expect(type.value).toBe("MINE");
  });

  it("omits disabled or empty texts", () => {
    expect(textPlacements({ ...base, enableOwnerEtch: false, enableTypeEtch: false }, stub)).toEqual([]);
    expect(textPlacements({ ...base, enableOwnerEtch: true, ownerName: "" }, stub)).toEqual([]);
  });
  it("unknown carrier uses the default text settings (rotation 0)", () => {
    const [owner] = textPlacements(
      { ...base, carrierType: "bogus-carrier", enableOwnerEtch: true, ownerName: "ADA" },
      stub,
    );
    // default [0,60,5]: xCenter = 60-5-5 = 50 ; xBase = -50 ; py = 0 ; rotate0 → (-50, 0)
    expect(owner.rotationDeg).toBe(0);
    expect(owner.cx).toBeCloseTo(-50, 6);
    expect(owner.cy).toBeCloseTo(0, 6);
  });

  it("beseler-45 owner+type: two rows on the left handle (rotation 0); bottom mirrors Y", () => {
    const ts = textPlacements(
      { ...base, carrierType: "beseler-45", topOrBottom: "top", enableOwnerEtch: true, ownerName: "ADA", enableTypeEtch: true },
      stub,
    );
    // handleCenterX = -(210/2 + 22) = -127 ; yBase = ±29/4 = ±7.25
    const owner = ts.find((t) => t.value === "ADA")!;
    expect(owner.rotationDeg).toBe(0);
    expect(owner.cx).toBeCloseTo(-127, 6);
    expect(owner.cy).toBeCloseTo(7.25, 6);
    const type = ts.find((t) => t.value === "35MM")!;
    expect(type.rotationDeg).toBe(0);
    expect(type.cx).toBeCloseTo(-127, 6);
    expect(type.cy).toBeCloseTo(-7.25, 6);
    const bottomOwner = textPlacements(
      { ...base, carrierType: "beseler-45", topOrBottom: "bottom", enableOwnerEtch: true, ownerName: "ADA" },
      stub,
    )[0];
    expect(bottomOwner.cy).toBeCloseTo(-7.25, 6);
  });

  it("measures and emits font size at the OpenSCAD em scale (size × 100/72)", () => {
    // OpenSCAD renders text(size=s) with an em of s × 100/72 (point size at
    // 100 dpi), so the SVG font-size — and the width measurement that feeds
    // the edge-margin position — must use the scaled size, not config.fontSize.
    const seen: number[] = [];
    const rec = (t: string, _f: string, s: number) => { seen.push(s); return t.length; };
    const [owner] = textPlacements(
      { ...base, enableOwnerEtch: true, ownerName: "ADA" },
      rec,
    );
    expect(owner.fontSize).toBeCloseTo(10 * (100 / 72), 6);
    expect(seen).toEqual([10 * (100 / 72)]);
  });

  it("lpl-saunders owner: rotated 270 with its own carrier edge (85)", () => {
    const [owner] = textPlacements(
      { ...base, carrierType: "lpl-saunders-45xx", alignmentBoardType: "lpl-saunders", enableOwnerEtch: true, ownerName: "ADA" },
      stub,
    );
    // xCenter = 85 - 5 - 10/2 = 75 ; xBase = -75 ; py = -65 ; rotate270(-75,-65) = (-65, 75)
    expect(owner.rotationDeg).toBe(270);
    expect(owner.cx).toBeCloseTo(-65, 6);
    expect(owner.cy).toBeCloseTo(75, 6);
  });
});

describe("buildScene", () => {
  it("assembles opening, 4 pegs, and no board overlay when board is off", () => {
    const s = buildScene({ ...base, alignmentBoard: false });
    expect(s.opening).toEqual({ w: 37, h: 24, chamfer: 0.5 });
    expect(s.pegs).toHaveLength(4);
    expect(s.pegs.every((p) => p.kind === "hole")).toBe(true); // bottom heat-set
    expect(s.boardKey).toBeNull();
    expect(s.screwHoles).toHaveLength(4);
  });

  it("selects the board outline key and drops footprint holes when attached", () => {
    expect(buildScene({ ...base, alignmentBoard: true, alignmentBoardType: "omega" }).boardKey).toBe("omega");
    expect(buildScene({ ...base, alignmentBoard: true, alignmentBoardType: "omega", filmFormat: "4x5" }).boardKey).toBe("omega-4x5");
    expect(buildScene({ ...base, alignmentBoard: true, alignmentBoardType: "lpl-saunders" }).boardKey).toBe("lpl-saunders");
    expect(buildScene({ ...base, alignmentBoard: true, alignmentBoardType: "omega" }).screwHoles).toEqual([]);
  });
  it("beseler-23c board selects its own outline key", () => {
    expect(buildScene({ ...base, carrierType: "beseler-23c", alignmentBoard: true, alignmentBoardType: "beseler-23c" }).boardKey)
      .toBe("beseler-23c");
  });

  it("beseler-45 bottom: 4 film pegs + 4 corner pegs at (±59.85, ±59.85) r=2.3", () => {
    const s = buildScene({ ...base, carrierType: "beseler-45", topOrBottom: "bottom" });
    expect(s.pegs).toHaveLength(8);
    const corners = s.pegs.slice(4);
    expect(corners).toHaveLength(4);
    for (const p of corners) {
      expect(Math.abs(p.cx)).toBeCloseTo(59.85, 6);
      expect(Math.abs(p.cy)).toBeCloseTo(59.85, 6);
      expect(p.r).toBe(2.3);
      expect(p.kind).toBe("peg");
    }
    // All four corner sign combinations present.
    const signs = new Set(corners.map((p) => `${Math.sign(p.cx)},${Math.sign(p.cy)}`));
    expect(signs.size).toBe(4);
    // No screw footprint / board overlay for beseler-45 (no alignment board by design).
    expect(s.screwHoles).toEqual([]);
    expect(s.boardKey).toBeNull();
  });

  it("beseler-45 top: 4 corner stacking holes r=3", () => {
    const s = buildScene({ ...base, carrierType: "beseler-45", topOrBottom: "top" });
    expect(s.pegs).toHaveLength(8);
    const corners = s.pegs.slice(4);
    for (const p of corners) {
      expect(Math.abs(p.cx)).toBeCloseTo(59.85, 6);
      expect(Math.abs(p.cy)).toBeCloseTo(59.85, 6);
      expect(p.r).toBe(3);
      expect(p.kind).toBe("hole");
    }
  });

  it("other carriers keep exactly 4 pegs (no corner pegs)", () => {
    for (const carrierType of ["omega-d", "lpl-saunders-45xx", "beseler-23c", "frameAndPegTest"]) {
      expect(buildScene({ ...base, carrierType }).pegs).toHaveLength(4);
    }
  });
});

describe("buildScene dimensions", () => {
  it("35mm vertical: four callouts derived from openingDimensions/pegPositions", () => {
    // openingDimensions(base) = { openingHeight: 37, openingWidth: 24 } (see above)
    // pegPositions(base) = { x: 14.8, y: 20.3 } (see above)
    const { dimensions } = buildScene(base);
    expect(dimensions).toEqual([
      { from: [-18.5, -18], to: [18.5, -18], label: "37.0 mm", axis: "x" },
      { from: [-24.5, -12], to: [-24.5, 12], label: "24.0 mm", axis: "y" },
      { from: [-14.8, 26.3], to: [14.8, 26.3], label: "29.6 mm", axis: "x" },
      { from: [20.8, -20.3], to: [20.8, 20.3], label: "40.6 mm", axis: "y" },
    ]);
  });

  it("35mm horizontal: opening axes and peg axes swap", () => {
    // openingDimensions horizontal = { openingHeight: 24, openingWidth: 37 }
    // pegPositions horizontal = { x: 20.3, y: 14.8 } (see above)
    const { dimensions } = buildScene({ ...base, orientation: "horizontal" });
    expect(dimensions).toEqual([
      { from: [-12, -24.5], to: [12, -24.5], label: "24.0 mm", axis: "x" },
      { from: [-18, -18.5], to: [-18, 18.5], label: "37.0 mm", axis: "y" },
      { from: [-20.3, 20.8], to: [20.3, 20.8], label: "40.6 mm", axis: "x" },
      { from: [26.3, -14.8], to: [26.3, 14.8], label: "29.6 mm", axis: "y" },
    ]);
  });

  it("custom format: uses the custom opening + film-width slider values", () => {
    // openingDimensions custom = { openingHeight: 50, openingWidth: 40 } (given directly)
    // pegPositions custom (customFilmWidth: 50) = { x: 21.3, y: 26.8 } (see above)
    const { dimensions } = buildScene({
      ...base, filmFormat: "custom",
      customOpeningHeight: 50, customOpeningWidth: 40, customFilmWidth: 50,
    });
    expect(dimensions).toEqual([
      { from: [-25, -26], to: [25, -26], label: "50.0 mm", axis: "x" },
      { from: [-31, -20], to: [-31, 20], label: "40.0 mm", axis: "y" },
      { from: [-21.3, 32.8], to: [21.3, 32.8], label: "42.6 mm", axis: "x" },
      { from: [27.3, -26.8], to: [27.3, 26.8], label: "53.6 mm", axis: "y" },
    ]);
  });
});

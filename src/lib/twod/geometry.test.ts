import { describe, it, expect } from "vitest";
import { openingDimensions, pegPositions, pegRadiusAndKind, screwFootprint, directionalArrow } from "./geometry";
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
  it("4x5 forces vertical regardless of orientation", () => {
    expect(openingDimensions({ ...base, filmFormat: "4x5", orientation: "horizontal" }))
      .toEqual({ openingHeight: 120, openingWidth: 95 });
  });
  it("applies film adjustments", () => {
    expect(openingDimensions({ ...base, adjustFilmHeight: 2, adjustFilmWidth: 1 }))
      .toEqual({ openingHeight: 39, openingWidth: 25 });
  });
  it("custom uses the custom opening dims directly (no orientation/adjust)", () => {
    expect(openingDimensions({ ...base, filmFormat: "custom", customOpeningHeight: 50, customOpeningWidth: 40, adjustFilmHeight: 9 }))
      .toEqual({ openingHeight: 50, openingWidth: 40 });
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

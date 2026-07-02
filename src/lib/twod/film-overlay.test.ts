import { describe, it, expect } from "vitest";
import { filmFamily, buildFilmOverlay } from "./film-overlay";
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

describe("filmFamily", () => {
  it("maps 35mm variants + half frame to 135", () => {
    for (const f of ["35mm", "35mm filed", "35mm full", "half frame"]) {
      expect(filmFamily(f)).toBe("135");
    }
  });
  it("maps 6x* to 120", () => {
    for (const f of ["6x4.5", "6x6", "6x6 filed", "6x7", "6x9 filed"]) {
      expect(filmFamily(f)).toBe("120");
    }
  });
  it("maps 4x5 to sheet and custom/unknown to none", () => {
    expect(filmFamily("4x5")).toBe("sheet");
    expect(filmFamily("custom")).toBe("none");
    expect(filmFamily("nonsense")).toBe("none");
  });
});

describe("buildFilmOverlay — 135 vertical", () => {
  const ov = buildFilmOverlay(base, 60);
  it("travel axis is X for vertical", () => {
    expect(ov.travelAxis).toBe("x");
  });
  it("film base is 35mm wide across (Y), spans the travel extent along X", () => {
    expect(ov.base).toEqual({ w: 120, h: 35 });
  });
  it("draws a true 36x24 image frame centered on the origin", () => {
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 36, h: 24 });
  });
  it("tiles frames at a 38mm pitch (36mm image + 2mm gap = 8 perforations)", () => {
    const next = ov.frames.find((f) => Math.abs(f.cx - 38) < 1e-9);
    expect(next).toBeTruthy();
    expect(next!.w).toBe(36);
  });
  it("has two sprocket rows at +/-14.75 across, holes 2.8x2.0 at 4.7625 pitch", () => {
    const rows = new Set(ov.sprockets.map((s) => s.cy));
    expect(rows.has(14.75)).toBe(true);
    expect(rows.has(-14.75)).toBe(true);
    const s0 = ov.sprockets.find((s) => s.cx === 0 && s.cy === 14.75);
    expect(s0).toEqual({ cx: 0, cy: 14.75, w: 2.8, h: 2.0 });
    const s1 = ov.sprockets.find((s) => Math.abs(s.cx - 4.7625) < 1e-9 && s.cy === 14.75);
    expect(s1).toBeTruthy();
  });
});

describe("buildFilmOverlay — orientation + families", () => {
  it("135 horizontal swaps axes (travel Y, frame is 24 wide x 36 tall)", () => {
    const ov = buildFilmOverlay({ ...base, orientation: "horizontal" }, 60);
    expect(ov.travelAxis).toBe("y");
    expect(ov.base).toEqual({ w: 35, h: 120 });
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 24, h: 36 });
  });
  it("filed 35mm keeps the true 36x24 image (filing reveals rebate, not a bigger image)", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "35mm filed" }, 60);
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 36, h: 24 });
  });
  it("120 (6x6) is 61mm wide across, 56x56 frame, no sprockets", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "6x6" }, 80);
    expect(ov.base).toEqual({ w: 160, h: 61 });
    expect(ov.sprockets).toEqual([]);
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 56, h: 56 });
  });
  it("4x5 is a single centered sheet (long edge along travel Y), no frames/sprockets", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "4x5" }, 80);
    expect(ov.travelAxis).toBe("y"); // 4x5 forced horizontal
    expect(ov.base).toEqual({ w: 101.6, h: 127 });
    expect(ov.frames).toEqual([]);
    expect(ov.sprockets).toEqual([]);
  });
  it("custom format returns an empty overlay", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "custom" }, 60);
    expect(ov.family).toBe("none");
    expect(ov.base).toBeNull();
    expect(ov.frames).toEqual([]);
    expect(ov.sprockets).toEqual([]);
  });
});

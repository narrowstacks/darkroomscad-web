import { describe, it, expect } from "vitest";
import {
  measureTextWidthMm, estimateTextWidthMm,
  measureBaselineShiftMm, estimateBaselineShiftMm,
  SCAD_TEXT_EM_SCALE,
} from "./measure-text";

// OpenSCAD's FreeType renderer treats text(size=s) as a point size at 100 dpi,
// so the rendered em is s * 100/72. Pinned here because the whole 2D text path
// (font-size, width measurement, baseline shift) hangs off this constant.
describe("SCAD_TEXT_EM_SCALE", () => {
  it("is 100/72", () => {
    expect(SCAD_TEXT_EM_SCALE).toBeCloseTo(100 / 72, 12);
  });
});

// jsdom has no canvas implementation, so the deterministic fallback is exercised.
describe("measureTextWidthMm", () => {
  it("returns 0 for empty text", () => {
    expect(measureTextWidthMm("", "Arial", 10)).toBe(0);
  });
  it("uses the fallback estimate when canvas is unavailable", () => {
    expect(measureTextWidthMm("ABCD", "Arial", 10)).toBeCloseTo(24, 5); // 4 * 10 * 0.6
  });
  it("scales with font size", () => {
    expect(measureTextWidthMm("AB", "Arial", 20)).toBeCloseTo(24, 5); // 2 * 20 * 0.6
  });
});

describe("estimateTextWidthMm", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTextWidthMm("", "Arial", 10)).toBe(0);
  });
  it("computes length * fontSize * 0.6", () => {
    expect(estimateTextWidthMm("ABCD", "Arial", 10)).toBeCloseTo(24, 5); // 4 * 10 * 0.6
  });
  it("scales with font size", () => {
    expect(estimateTextWidthMm("AB", "Arial", 20)).toBeCloseTo(24, 5); // 2 * 20 * 0.6
  });
});

// Baseline shift replicates OpenSCAD valign="center": the glyph baseline sits
// (ink ascent - ink descent) / 2 below the anchor so the string's ink bbox is
// vertically centered. jsdom has no canvas, so these exercise the fallback
// (half the ~0.66-em cap height of a typical all-caps label).
describe("baseline shift", () => {
  it("estimate is half the approximate cap height", () => {
    expect(estimateBaselineShiftMm("NAME", "Arial", 10)).toBeCloseTo(3.3, 5); // 10 * 0.66 / 2
  });
  it("estimate is 0 for empty text", () => {
    expect(estimateBaselineShiftMm("", "Arial", 10)).toBe(0);
  });
  it("measure falls back to the estimate when canvas is unavailable", () => {
    expect(measureBaselineShiftMm("NAME", "Arial", 10)).toBeCloseTo(3.3, 5);
  });
});

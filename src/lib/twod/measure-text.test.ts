import { describe, it, expect } from "vitest";
import { measureTextWidthMm } from "./measure-text";

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

import { describe, it, expect } from "vitest";
import { extractOuterContour } from "./outer-contour";

// An OpenSCAD-style SVG: a big outer square (0,0..100,100) and a small inner
// square (40,40..60,60) — the inner one is a "hole" and must be dropped.
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0,0 L100,0 L100,100 L0,100 Z M40,40 L60,40 L60,60 L40,60 Z" /></svg>`;

describe("extractOuterContour", () => {
  it("keeps only the largest (outer) subpath", () => {
    const { d } = extractOuterContour(svg);
    expect(d).toContain("M0,0");
    expect(d).not.toContain("M40,40"); // inner hole dropped
  });
  it("returns a viewBox covering the outer contour", () => {
    const { viewBox } = extractOuterContour(svg);
    expect(viewBox).toBe("0 0 100 100");
  });
  it("throws when no path data is present", () => {
    expect(() => extractOuterContour("<svg></svg>")).toThrow();
  });
});

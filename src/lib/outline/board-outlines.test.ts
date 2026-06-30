import { describe, it, expect } from "vitest";
import { BOARD_OUTLINES } from "./board-outlines";

describe("BOARD_OUTLINES", () => {
  it("has all four board variants with plausible geometry", () => {
    for (const key of ["omega", "omega-4x5", "lpl-saunders", "beseler-23c"]) {
      const o = BOARD_OUTLINES[key];
      expect(o, key).toBeDefined();
      expect(o.d.length).toBeGreaterThan(50);
      const [, , w, h] = o.viewBox.split(/\s+/).map(Number);
      expect(w, `${key} width`).toBeGreaterThan(100);
      expect(h, `${key} height`).toBeGreaterThan(100);
    }
  });

  it("omega and omega-4x5 differ (opening width)", () => {
    expect(BOARD_OUTLINES["omega"].d).not.toBe(BOARD_OUTLINES["omega-4x5"].d);
  });
});

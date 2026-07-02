import { describe, it, expect } from "vitest";
import { CARRIER_CAPABILITIES, BOARD_CARRIERS, BAKED_CARRIERS, BAKED_BOARD_TYPES } from "./carriers";

describe("carrier capability registry", () => {
  it("BOARD_CARRIERS is exactly the carriers with an alignment board", () => {
    expect(BOARD_CARRIERS).toEqual(new Set(["omega-d", "lpl-saunders-45xx", "beseler-23c"]));
  });

  it("BAKED_CARRIERS is exactly the carriers with a baked base STL", () => {
    expect(BAKED_CARRIERS).toEqual(new Set(["omega-d", "lpl-saunders-45xx", "beseler-23c", "beseler-45"]));
  });

  it("BAKED_BOARD_TYPES is exactly the board types with a baked STL", () => {
    expect(BAKED_BOARD_TYPES).toEqual(new Set(["omega", "lpl-saunders", "beseler-23c"]));
  });

  it("beseler-45 is registered: baked base, no alignment board (by design)", () => {
    expect(CARRIER_CAPABILITIES["beseler-45"]).toEqual({ hasAlignmentBoard: false, hasBakedBase: true });
  });
});

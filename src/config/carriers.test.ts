import { describe, it, expect } from "vitest";
import {
  CARRIER_CAPABILITIES, BOARD_CARRIERS, BAKED_CARRIERS, BAKED_BOARD_TYPES,
  SCREW_ON_BOARD_CARRIERS, SINGLE_PIECE_CARRIERS, FILM_PEG_CARRIERS,
  lockedFormat, screwOnBoardType,
} from "./carriers";

describe("carrier capability registry", () => {
  it("BOARD_CARRIERS is exactly the carriers with an alignment board", () => {
    expect(BOARD_CARRIERS).toEqual(new Set(["omega-d", "omega-d-glass", "lpl-saunders-45xx", "beseler-23c"]));
  });

  it("omega-d-glass is the only single-piece, peg-less, screw-on-board carrier (not baked)", () => {
    expect(SCREW_ON_BOARD_CARRIERS).toEqual(new Set(["omega-d-glass"]));
    expect(SINGLE_PIECE_CARRIERS).toEqual(new Set(["omega-d-glass"]));
    expect(FILM_PEG_CARRIERS.has("omega-d-glass")).toBe(false);
    expect(FILM_PEG_CARRIERS.has("omega-d")).toBe(true);
    expect(BAKED_CARRIERS.has("omega-d-glass")).toBe(false);
    expect(lockedFormat("omega-d-glass")).toBe("4x5");
    expect(lockedFormat("omega-d")).toBeNull();
    expect(screwOnBoardType("omega-d-glass")).toBe("omega");
    expect(screwOnBoardType("omega-d")).toBeNull();
  });

  it("BAKED_CARRIERS is exactly the carriers with a baked base STL", () => {
    expect(BAKED_CARRIERS).toEqual(new Set(["omega-d", "lpl-saunders-45xx", "beseler-23c", "beseler-45"]));
  });

  it("BAKED_BOARD_TYPES is exactly the board types with a baked STL", () => {
    expect(BAKED_BOARD_TYPES).toEqual(new Set(["omega", "lpl-saunders", "beseler-23c"]));
  });

  it("beseler-45 is registered: baked base, no alignment board (by design)", () => {
    expect(CARRIER_CAPABILITIES["beseler-45"]).toEqual({ hasAlignmentBoard: false, hasFilmPegs: true, hasBakedBase: true });
  });
});

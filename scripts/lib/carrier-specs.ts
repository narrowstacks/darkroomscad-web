/**
 * Build-time carrier/board → SCAD source mapping, shared by gen-base-stls.ts
 * and gen-carrier-outlines.ts (they used to carry hand-synced copies of this
 * table). Adding a carrier or board means adding ONE entry here.
 *
 * This is build-time knowledge (SCAD module names); it must NOT be imported by
 * the app's runtime carrier registry (src/config/carriers.ts) or any client code.
 */

export interface CarrierSpec {
  /** Base-shape SCAD file to include, relative to the WASM FS root. */
  include: string;
  /**
   * Module invocation producing the carrier BODY only, for a given part.
   * arg0 is an unused config value.
   */
  call: (part: "top" | "bottom") => string;
  /**
   * gen-base-stls bakes a `<key>-<part>.stl` for it. The test frame is
   * intentionally excluded — its base geometry depends on film format, and it
   * already renders fast parametrically.
   */
  bakesBaseStl: boolean;
  /**
   * Optional bake-path overrides for when the baked body differs from the
   * outline body (extra parameter-independent geometry baked in). Default to
   * `include` / `call`. beseler-45 uses these to bake its fixed corner
   * alignment/stacking pegs (which live in the universal assembly, not the base
   * shape) into the STL, while its outline stays the bare base shape.
   */
  bakeInclude?: string;
  bakeCallOverride?: (part: "top" | "bottom") => string;
  /**
   * gen-carrier-outlines entry: required projected bbox minimums (catches
   * Manifold silently dropping a unioned feature). null = no outline generated.
   */
  outline: { minWidth: number; minHeight: number } | null;
}

export interface BoardSpec {
  /** Alignment-board SCAD file to include, relative to the WASM FS root. */
  include: string;
  /** Full module invocation (boards take film-format-ish args, not top/bottom). */
  call: string;
  /** gen-base-stls output name (`<bakeName>.stl`), or null if not baked. */
  bakeName: string | null;
  /** gen-carrier-outlines entry (all contours kept, evenodd), or null. */
  outline: { minWidth: number; minHeight: number } | null;
}

export const CARRIER_SPECS: Record<string, CarrierSpec> = {
  "omega-d": {
    include: "src/omega-d-base-shape.scad",
    call: (part) => `omega_d_base_shape([], "${part}");`,
    bakesBaseStl: true,
    outline: { minWidth: 200, minHeight: 165 }, // body ~202 long, ~168 tall
  },
  "lpl-saunders-45xx": {
    include: "src/lpl-saunders-base-shape.scad",
    call: (part) => `lpl_saunders_base_shape([], "${part}");`,
    bakesBaseStl: true,
    outline: { minWidth: 220, minHeight: 175 }, // ~178 clipped circle + handle (~228 wide)
  },
  "beseler-23c": {
    include: "src/beseler-23c-base-shape.scad",
    call: (part) => `beseler_23c_base_shape([], "${part}");`,
    bakesBaseStl: true,
    outline: { minWidth: 190, minHeight: 155 }, // 160 circle + handle (~197 wide)
  },
  // beseler-45: 210mm disc + left (-X) handle → bbox ~260 x 210mm. The outline is
  // the bare base shape; the baked STL additionally fuses the fixed corner
  // alignment pegs (bottom) / stacking holes (top) from the universal assembly.
  "beseler-45": {
    include: "src/beseler-45-base-shape.scad",
    call: (part) => `beseler_45_base_shape([], "${part}");`,
    bakesBaseStl: true,
    bakeInclude: "src/common/universal-carrier-assembly.scad",
    bakeCallOverride: (part) =>
      part === "bottom"
        ? `beseler_45_base_shape([], "bottom"); beseler45_corner_pegs();`
        : `difference() { beseler_45_base_shape([], "top"); beseler45_corner_peg_holes(); }`,
    outline: { minWidth: 250, minHeight: 200 },
  },
  frameAndPegTest: {
    include: "src/test-frame-base-shape.scad",
    call: (part) => `test_frame_base_shape([2,5.6,4], "${part}", 36, 24, 25, 35);`,
    bakesBaseStl: false,
    outline: { minWidth: 70, minHeight: 90 }, // simple rounded rectangle
  },
};

// Omega's opening widens for 4x5 (the film_format arg only matters via
// `== "4x5"` checks), so it gets two variants; lpl/beseler boards are
// format-independent (one each).
export const BOARD_SPECS: Record<string, BoardSpec> = {
  omega: {
    include: "src/common/omega-d-alignment-board.scad",
    call: 'omega_d_alignment_board_no_screws("");',
    bakeName: "board-omega",
    outline: { minWidth: 120, minHeight: 120 },
  },
  "omega-4x5": {
    include: "src/common/omega-d-alignment-board.scad",
    call: 'omega_d_alignment_board_no_screws("4x5");',
    bakeName: "board-omega-4x5",
    outline: { minWidth: 120, minHeight: 120 },
  },
  "lpl-saunders": {
    include: "src/common/lpl-saunders-alignment-board.scad",
    call: "lpl_saunders_alignment_board();",
    bakeName: "board-lpl-saunders",
    outline: { minWidth: 150, minHeight: 100 },
  },
  "beseler-23c": {
    include: "src/common/beseler-23c-alignment-board.scad",
    call: "beseler_23c_alignment_board();",
    bakeName: "board-beseler-23c",
    outline: { minWidth: 110, minHeight: 110 },
  },
};

// Single source of truth for per-carrier capabilities. Every module that needs
// "which carriers have X" derives from this table instead of declaring its own
// list (they used to drift: carrier-ui, preview-engine, twod/geometry, and
// part-enumeration each carried a copy).
//
// beseler-45 is intentionally absent: it is unimplemented (carrier.scad asserts
// on it) and hidden in the UI — add it here only when it actually works.

export interface CarrierCapabilities {
  /** Carrier can pair with an alignment board (test frames can't). */
  hasAlignmentBoard: boolean;
  /** A pre-baked base STL exists in public/base-stls (see scripts/gen-base-stls.ts). */
  hasBakedBase: boolean;
}

export const CARRIER_CAPABILITIES: Record<string, CarrierCapabilities> = {
  "omega-d":           { hasAlignmentBoard: true,  hasBakedBase: true },
  "lpl-saunders-45xx": { hasAlignmentBoard: true,  hasBakedBase: true },
  "beseler-23c":       { hasAlignmentBoard: true,  hasBakedBase: true },
  "frameAndPegTest":   { hasAlignmentBoard: false, hasBakedBase: false },
};

const byFlag = (flag: keyof CarrierCapabilities): ReadonlySet<string> =>
  new Set(Object.keys(CARRIER_CAPABILITIES).filter((k) => CARRIER_CAPABILITIES[k][flag]));

/** Carriers that have an alignment board. */
export const BOARD_CARRIERS: ReadonlySet<string> = byFlag("hasAlignmentBoard");
/** Carriers with a baked base STL for the fast preview path. */
export const BAKED_CARRIERS: ReadonlySet<string> = byFlag("hasBakedBase");

/** Board TYPES (Alignment_Board_Type values — a different namespace than
 *  carrier types) that have baked STLs in public/base-stls. */
export const BAKED_BOARD_TYPES: ReadonlySet<string> = new Set([
  "omega", "lpl-saunders", "beseler-23c",
]);

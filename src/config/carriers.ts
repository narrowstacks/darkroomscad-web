// Single source of truth for per-carrier capabilities. Every module that needs
// "which carriers have X" derives from this table instead of declaring its own
// list (they used to drift: carrier-ui, preview-engine, twod/geometry, and
// part-enumeration each carried a copy).
//
// beseler-45 has no alignment board BY DESIGN (its fixed corner pegs align it
// in the enlarger; carrier.scad forces board type "none"), so its
// hasAlignmentBoard is false while hasBakedBase is true.

export interface CarrierCapabilities {
  /** Carrier can pair with an alignment board (test frames can't). */
  hasAlignmentBoard: boolean;
  /** A pre-baked base STL exists in public/base-stls (see scripts/gen-base-stls.ts). */
  hasBakedBase: boolean;
  /** Film formats this carrier physically can't take (base names, no " filed"). */
  unsupportedFormats?: readonly string[];
}

export const CARRIER_CAPABILITIES: Record<string, CarrierCapabilities> = {
  "omega-d":           { hasAlignmentBoard: true,  hasBakedBase: true },
  "lpl-saunders-45xx": { hasAlignmentBoard: true,  hasBakedBase: true },
  // The 23C is a medium-format enlarger — its 160mm carrier can't take a 4x5 sheet.
  "beseler-23c":       { hasAlignmentBoard: true,  hasBakedBase: true, unsupportedFormats: ["4x5"] },
  "beseler-45":        { hasAlignmentBoard: false, hasBakedBase: true },
  "frameAndPegTest":   { hasAlignmentBoard: false, hasBakedBase: false },
};

/** Format bases the given carrier can't take (empty set for unknown carriers). */
export function unsupportedFormats(carrierType: string): ReadonlySet<string> {
  return new Set(CARRIER_CAPABILITIES[carrierType]?.unsupportedFormats ?? []);
}

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

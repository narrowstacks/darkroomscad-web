// Single source of truth for per-carrier capabilities. Every module that needs
// "which carriers have X" derives from this table instead of declaring its own
// list (they used to drift: carrier-ui, preview-engine, twod/geometry, and
// part-enumeration each carried a copy).
//
// beseler-45 has no alignment board BY DESIGN (its fixed corner pegs align it
// in the enlarger; carrier.scad forces board type "none"), so its
// hasAlignmentBoard is false while hasBakedBase is true.
//
// omega-d-glass is a single 4mm piece with a pocket for a 4x5 glass plate: no
// top half, no film pegs (the pocket locates the plate), and its alignment
// board is screwed on from below (own screw footprint) rather than fused —
// carrier.scad forces all of that regardless of the Top/Bottom, peg and
// Alignment_Board params.
//
// A 4x5 sheet is locked to horizontal (long edge along Y) except on the two
// Omega-D carriers (carrier_allows_4x5_orientation in carrier-features.scad):
// their round body and handle-side text clear a 120mm-wide opening, and the
// omega board's 4x5 cutout + screw pattern turn with the sheet. The LPL's
// text at x = -65 would run into it, so it stays locked.

export interface CarrierCapabilities {
  /** Carrier can pair with an alignment board (test frames can't). */
  hasAlignmentBoard: boolean;
  /** The board is always a separate, screwed-on part of this type: never
   *  fused, always exported, no board-type choice. */
  boardScrewOn?: string;
  /** One piece (no top half): Top/Bottom and flip-for-printing don't apply. */
  singlePiece?: boolean;
  /** The only film format this carrier takes (the picker locks to it). */
  lockedFormat?: string;
  /** 4x5 honours the Orientation toggle (otherwise the SCAD locks it to
   *  horizontal — get_effective_orientation). */
  orientable4x5?: boolean;
  /** Has the four film registration pegs/holes. */
  hasFilmPegs: boolean;
  /** A pre-baked base STL exists in public/base-stls (see scripts/gen-base-stls.ts). */
  hasBakedBase: boolean;
  /** Film formats this carrier physically can't take (base names, no " filed"). */
  unsupportedFormats?: readonly string[];
}

export const CARRIER_CAPABILITIES: Record<string, CarrierCapabilities> = {
  "omega-d":           { hasAlignmentBoard: true,  hasFilmPegs: true,  hasBakedBase: true, orientable4x5: true },
  "omega-d-glass":     { hasAlignmentBoard: true,  boardScrewOn: "omega", singlePiece: true, lockedFormat: "4x5", orientable4x5: true, hasFilmPegs: false, hasBakedBase: false },
  "lpl-saunders-45xx": { hasAlignmentBoard: true,  hasFilmPegs: true,  hasBakedBase: true },
  // The 23C is a medium-format enlarger — its 160mm carrier can't take a 4x5 sheet.
  "beseler-23c":       { hasAlignmentBoard: true,  hasFilmPegs: true,  hasBakedBase: true, unsupportedFormats: ["4x5"] },
  "beseler-45":        { hasAlignmentBoard: false, hasFilmPegs: true,  hasBakedBase: true },
  "frameAndPegTest":   { hasAlignmentBoard: false, hasFilmPegs: true,  hasBakedBase: false },
};

/** Format bases the given carrier can't take (empty set for unknown carriers). */
export function unsupportedFormats(carrierType: string): ReadonlySet<string> {
  return new Set(CARRIER_CAPABILITIES[carrierType]?.unsupportedFormats ?? []);
}

/** The single format a carrier is locked to, or null when it's a free choice. */
export function lockedFormat(carrierType: string): string | null {
  return CARRIER_CAPABILITIES[carrierType]?.lockedFormat ?? null;
}

/** Does a 4x5 sheet honour the Orientation toggle on this carrier? (Port of
 *  carrier_allows_4x5_orientation; elsewhere 4x5 is locked to horizontal.) */
export function allows4x5Orientation(carrierType: string): boolean {
  return CARRIER_CAPABILITIES[carrierType]?.orientable4x5 === true;
}

/** Board type of a carrier's screw-on board, or null when the board is a
 *  regular (optionally fused, user-chosen) one. */
export function screwOnBoardType(carrierType: string): string | null {
  return CARRIER_CAPABILITIES[carrierType]?.boardScrewOn ?? null;
}

const byFlag = (flag: keyof CarrierCapabilities): ReadonlySet<string> =>
  new Set(Object.keys(CARRIER_CAPABILITIES).filter((k) => CARRIER_CAPABILITIES[k][flag]));

/** Carriers that have an alignment board (fused or screwed on). */
export const BOARD_CARRIERS: ReadonlySet<string> = byFlag("hasAlignmentBoard");
/** Carriers whose board is always a separate screwed-on part (never fused). */
export const SCREW_ON_BOARD_CARRIERS: ReadonlySet<string> = byFlag("boardScrewOn");
/** Single-piece carriers (no top half). */
export const SINGLE_PIECE_CARRIERS: ReadonlySet<string> = byFlag("singlePiece");
/** Carriers with film registration pegs. */
export const FILM_PEG_CARRIERS: ReadonlySet<string> = byFlag("hasFilmPegs");
/** Carriers with a baked base STL for the fast preview path. */
export const BAKED_CARRIERS: ReadonlySet<string> = byFlag("hasBakedBase");

/** Board TYPES (Alignment_Board_Type values — a different namespace than
 *  carrier types) that have baked STLs in public/base-stls. */
export const BAKED_BOARD_TYPES: ReadonlySet<string> = new Set([
  "omega", "lpl-saunders", "beseler-23c",
]);

import type { TwoDConfig } from "./types";
import { FILM_FORMATS, isFiledFormat } from "./film-data";

// Constants from carrier-features.scad / carrier-configs.scad.
const PEG_DIAMETER = 5.6;
const PEG_RADIUS = PEG_DIAMETER / 2;          // 2.8
const PEG_HOLE_TOLERANCE = 0.25;
const M2_HEAT_SET_HOLE_DIA = 1.6;             // bottom heat-set hole
const M2_SOCKET_HEAD_DIA = 3.8;               // top heat-set socket clearance
export const FILM_OPENING_FILLET = 0.5;       // UNIVERSAL_FILM_OPENING_FRAME_FILLET

export function effectiveOrientation(c: TwoDConfig): "vertical" | "horizontal" {
  return c.filmFormat === "4x5" ? "vertical" : c.orientation;
}

function filmDims(c: TwoDConfig): { height: number; width: number; pegDistance: number } {
  if (c.filmFormat === "custom") {
    return { height: c.customFilmHeight, width: c.customFilmWidth, pegDistance: c.customFilmWidth };
  }
  const f = FILM_FORMATS[c.filmFormat] ?? FILM_FORMATS["35mm"];
  return { height: f.height, width: f.width, pegDistance: f.pegDistance };
}

// Port of get_custom_aware_opening_* (carrier-features.scad). Returned as the
// film_opening cuboid axes: X-extent = openingHeight, Y-extent = openingWidth.
export function openingDimensions(c: TwoDConfig): { openingHeight: number; openingWidth: number } {
  if (c.filmFormat === "custom") {
    return { openingHeight: c.customOpeningHeight, openingWidth: c.customOpeningWidth };
  }
  const { height, width } = filmDims(c);
  const eff = effectiveOrientation(c);
  const calcHeight = eff === "vertical" ? height : width;
  const calcWidth = eff === "vertical" ? width : height;
  return {
    openingHeight: calcHeight + c.adjustFilmHeight,
    openingWidth: calcWidth + c.adjustFilmWidth,
  };
}

// Port of calculate_internal_peg_gap.
function internalPegGap(c: TwoDConfig): number {
  return isFiledFormat(c.filmFormat) ? (1 - c.pegGap) - 1 : (1 - c.pegGap);
}

// Port of calculate_unified_peg_positions (omega style; used for all carriers).
export function pegPositions(c: TwoDConfig): { x: number; y: number } {
  const { width, pegDistance } = filmDims(c);
  const filmWidthRaw = width + c.adjustFilmWidth;
  const eff = effectiveOrientation(c);
  const gap = internalPegGap(c);
  // calculate_omega_style_peg_coordinate(is_dominant, filmWidthHalf, pegDistHalf, r, gap)
  const coord = (dominant: boolean) =>
    dominant ? filmWidthRaw / 2 + PEG_RADIUS : pegDistance / 2 + PEG_RADIUS - gap;
  return { x: coord(eff === "vertical"), y: coord(eff === "horizontal") };
}

// Port of the drawn peg/hole radius by top/bottom × printed/heat_set
// (generate_peg_features in carrier-features.scad).
export function pegRadiusAndKind(c: TwoDConfig): { r: number; kind: "peg" | "hole" } {
  if (c.topOrBottom === "bottom") {
    return c.pegStyle === "printed"
      ? { r: PEG_RADIUS, kind: "peg" }                       // additive printed peg
      : { r: M2_HEAT_SET_HOLE_DIA / 2, kind: "hole" };       // 0.8
  }
  // top
  return c.pegStyle === "printed"
    ? { r: PEG_RADIUS + PEG_HOLE_TOLERANCE, kind: "hole" }   // 3.05
    : { r: M2_SOCKET_HEAD_DIA / 2, kind: "hole" };           // 1.9
}

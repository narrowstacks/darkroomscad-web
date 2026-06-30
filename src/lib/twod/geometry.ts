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
      : { r: M2_HEAT_SET_HOLE_DIA / 2 + PEG_HOLE_TOLERANCE, kind: "hole" };       // 1.05
  }
  // top
  return c.pegStyle === "printed"
    ? { r: PEG_RADIUS + PEG_HOLE_TOLERANCE, kind: "hole" }   // 3.05
    : { r: M2_SOCKET_HEAD_DIA / 2 + PEG_HOLE_TOLERANCE, kind: "hole" };           // 2.15
}

// Port of generate_universal_alignment_footprint_holes + alignment_footprint_holes.
// Holes appear only when the board is NOT attached and the board type is
// omega/lpl (so the carrier can screw onto a separately-printed board).
const SCREW_PATTERN_DIST_X = 82;   // UNIVERSAL_ALIGNMENT_SCREW_PATTERN_DIST_X
const SCREW_PATTERN_DIST_Y = 113;  // UNIVERSAL_ALIGNMENT_SCREW_PATTERN_DIST_Y
const SCREW_DIAMETER = 2;          // UNIVERSAL_ALIGNMENT_SCREW_DIAMETER
const BOARD_CARRIERS = new Set(["omega-d", "lpl-saunders-45xx", "beseler-23c"]);

export function screwFootprint(c: TwoDConfig): { cx: number; cy: number; r: number }[] {
  const usesFootprint = c.alignmentBoardType === "omega" || c.alignmentBoardType === "lpl-saunders";
  if (c.alignmentBoard || !usesFootprint || !BOARD_CARRIERS.has(c.carrierType)) return [];
  const ex = SCREW_PATTERN_DIST_X / 2;  // 41
  const ey = SCREW_PATTERN_DIST_Y / 2;  // 56.5
  const r = SCREW_DIAMETER / 2;         // 1
  const out: { cx: number; cy: number; r: number }[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push({ cx: sx * ex, cy: sy * ey, r });
  return out;
}

// Port of directional arrow (carrier-features.scad). Only 6x6 / 6x6 filed.
// Replicates: translate(pos) rotate(rotZ) [ translate(-10,0) polygon ].
const ARROW_LENGTH = 8;
const ARROW_WIDTH = 5;
const ARROW_INTERNAL_X_OFFSET = -10;
const ARROW_OFFSET = 5;

function rotate2d([x, y]: [number, number], deg: number): [number, number] {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

export function directionalArrow(c: TwoDConfig): { points: [number, number][] } | null {
  if (c.filmFormat !== "6x6" && c.filmFormat !== "6x6 filed") return null;
  const { openingWidth } = openingDimensions(c);
  const eff = effectiveOrientation(c);
  // calculate_arrow_position
  const pos: [number, number] = eff === "vertical"
    ? [-ARROW_INTERNAL_X_OFFSET, -(openingWidth / 2 + ARROW_OFFSET + ARROW_LENGTH / 2)]
    : [openingWidth / 2 + ARROW_OFFSET + ARROW_LENGTH / 2, ARROW_INTERNAL_X_OFFSET];
  const rotZ = eff === "vertical" ? 0 : 90;
  // arrow_etch local polygon, pre-shifted by its internal translate(-10, 0).
  const local: [number, number][] = [
    [-ARROW_LENGTH / 2, 0], [ARROW_LENGTH / 2, ARROW_WIDTH / 2], [ARROW_LENGTH / 2, -ARROW_WIDTH / 2],
  ];
  const points = local.map((p) => {
    const shifted: [number, number] = [p[0] + ARROW_INTERNAL_X_OFFSET, p[1]];
    const [rx, ry] = rotate2d(shifted, rotZ);
    return [Number((rx + pos[0]).toFixed(6)), Number((ry + pos[1]).toFixed(6))] as [number, number];
  });
  return { points };
}

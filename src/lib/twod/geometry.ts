import type { TwoDConfig, TextPlacement, Scene, PegShape, DimensionAnnotation } from "./types";
import { FILM_FORMATS, isFiledFormat, filmTypeName } from "./film-data";
import { measureTextWidthMm, SCAD_TEXT_EM_SCALE } from "./measure-text";
import { BOARD_CARRIERS } from "@/config/carriers";

// Default film dimensions used by SCAD when format is "custom" and no override
// is passed — matches film-sizes.scad customFilmFormatWidth / customFilmFormatHeight.
const CUSTOM_FILM_DEFAULT_WIDTH = 37;   // film-sizes.scad customFilmFormatWidth
const CUSTOM_FILM_DEFAULT_HEIGHT = 37;  // film-sizes.scad customFilmFormatHeight

// Constants from carrier-features.scad / carrier-configs.scad.
const PEG_DIAMETER = 5.6;
const PEG_RADIUS = PEG_DIAMETER / 2;          // 2.8
const PEG_HOLE_TOLERANCE = 0.25;
const M2_HEAT_SET_HOLE_DIA = 1.6;             // bottom heat-set hole
const M2_SOCKET_HEAD_DIA = 3.8;               // top heat-set socket clearance
export const FILM_OPENING_FILLET = 0.5;       // UNIVERSAL_FILM_OPENING_FRAME_FILLET

// 4x5 is always "horizontal" (long 120mm edge along Y, perpendicular to the
// left handle) — the Orientation toggle has no effect for it. Port of
// get_effective_orientation (carrier-features.scad).
export function effectiveOrientation(c: TwoDConfig): "vertical" | "horizontal" {
  return c.filmFormat === "4x5" ? "horizontal" : c.orientation;
}

function filmDims(c: TwoDConfig): { height: number; width: number; pegDistance: number } {
  if (c.filmFormat === "custom") {
    // SCAD's peg calc calls get_film_format_width("custom") WITHOUT the custom
    // override, so the dominant peg axis uses the 37mm default; only the peg
    // distance uses Custom_Film_Width. (openingDimensions handles custom opening
    // sizes separately and never reads these.)
    return { height: CUSTOM_FILM_DEFAULT_HEIGHT, width: CUSTOM_FILM_DEFAULT_WIDTH, pegDistance: c.customFilmWidth };
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

// Port of _get_text_settings (carrier-configs.scad): [yTranslate, carrierEdge, edgeMargin].
function textSettings(carrierType: string): [number, number, number] {
  if (carrierType === "omega-d") return [-90, 69.5, 5];
  if (carrierType === "lpl-saunders-45xx") return [-65, 85, 5];
  if (carrierType === "beseler-23c") return [-65, 60, 5];
  if (carrierType === "beseler-45") return [0, 105, 5];
  return [0, 60, 5];
}

// Port of get_text_rotation.
function textRotation(carrierType: string): number {
  if (carrierType === "omega-d" || carrierType === "lpl-saunders-45xx") return 270;
  return 0;
}

const BESELER_DIAMETER = 160;
const BESELER_HANDLE_WIDTH = 42;

// Beseler 45 (carrier-configs.scad): 210mm disc, 29mm-wide left (-X) handle, and
// fixed corner alignment/stacking pegs on a 119.7mm center-to-center square.
const BESELER_45_DIAMETER = 210;
const BESELER_45_HANDLE_WIDTH = 29;
const BESELER_45_ALIGN_PEG_SPACING = 119.7;             // pegs at ±59.85
const BESELER_45_ALIGN_PEG_DIAMETER = 4.6;              // bottom peg (down-only)
const BESELER_45_ALIGN_PEG_HOLE_DIAMETER = 6;           // top stacking hole

// Port of calculate_text_position (pre-rotation [x, y]).
function textPositionPre(
  c: TwoDConfig, kind: "owner" | "type", textWidth: number,
): [number, number] {
  if (c.carrierType === "beseler-23c") {
    const handleCenterX = -BESELER_DIAMETER / 2;                 // -80
    const yBase = kind === "owner" ? BESELER_HANDLE_WIDTH / 4 : -BESELER_HANDLE_WIDTH / 4; // ±10.5
    const yOffset = c.topOrBottom === "bottom" ? -yBase : yBase;
    const xPos = kind === "owner" ? handleCenterX : handleCenterX - 15; // -80 / -95
    return [xPos, yOffset];
  }
  if (c.carrierType === "beseler-45") {
    // Port of calculate_text_position's beseler-45 arm: text lives on the left
    // (-X) handle, two rows across the 29mm handle width (like beseler-23c).
    const handleCenterX = -(BESELER_45_DIAMETER / 2 + 22);                                 // -127
    const yBase = kind === "owner" ? BESELER_45_HANDLE_WIDTH / 4 : -BESELER_45_HANDLE_WIDTH / 4; // ±7.25
    const yOffset = c.topOrBottom === "bottom" ? -yBase : yBase;
    return [handleCenterX, yOffset];
  }
  const [yTranslate, carrierEdge, edgeMargin] = textSettings(c.carrierType);
  const xCenter = carrierEdge - edgeMargin - textWidth / 2;
  const xBase = kind === "owner" ? -xCenter : xCenter;
  return [xBase, yTranslate];
}

export function textPlacements(
  c: TwoDConfig,
  measure: (t: string, f: string, s: number) => number = measureTextWidthMm,
): TextPlacement[] {
  const out: TextPlacement[] = [];
  const rotationDeg = textRotation(c.carrierType);
  // OpenSCAD renders text(size=s) at an em of s × 100/72, so both the width
  // used for the edge-margin placement and the emitted SVG font-size must use
  // the scaled em (see SCAD_TEXT_EM_SCALE).
  const svgFontSize = c.fontSize * SCAD_TEXT_EM_SCALE;
  const add = (kind: "owner" | "type", value: string, offset: [number, number]) => {
    if (!value) return;
    const width = measure(value, c.fontFace, svgFontSize);
    const pre = textPositionPre(c, kind, width);
    const adj: [number, number] = [pre[0] + offset[0], pre[1] + offset[1]];
    const [cx, cy] = rotate2d(adj, rotationDeg);
    out.push({ value, cx, cy, rotationDeg, fontFace: c.fontFace, fontSize: svgFontSize });
  };
  if (c.enableOwnerEtch) add("owner", c.ownerName, c.ownerTextOffset);
  if (c.enableTypeEtch) {
    const typeValue = c.typeNameSource === "Custom" ? c.customTypeName : filmTypeName(c.filmFormat);
    add("type", typeValue, c.typeTextOffset);
  }
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

// Fixed callout offset (mm) placing a dimension line just outside the extent
// it measures. v1 keeps this constant rather than a layout heuristic.
const DIMENSION_OFFSET = 6;

// The four v1 dimension callouts: opening X/Y extents and peg-center spacing
// X/Y. Labels report the value along the drawn axis (see the opening-axis
// convention note on buildScene below), formatted to one decimal.
function dimensionAnnotations(
  openingHeight: number, openingWidth: number, pegX: number, pegY: number,
): DimensionAnnotation[] {
  const halfH = openingHeight / 2;
  const halfW = openingWidth / 2;
  return [
    {
      // Opening X extent (scene.opening.w = openingHeight): horizontal
      // callout just below the opening.
      from: [-halfH, -halfW - DIMENSION_OFFSET],
      to: [halfH, -halfW - DIMENSION_OFFSET],
      label: `${openingHeight.toFixed(1)} mm`,
      axis: "x",
    },
    {
      // Opening Y extent (openingWidth): vertical callout just left of the opening.
      from: [-halfH - DIMENSION_OFFSET, -halfW],
      to: [-halfH - DIMENSION_OFFSET, halfW],
      label: `${openingWidth.toFixed(1)} mm`,
      axis: "y",
    },
    {
      // Peg spacing X (center-to-center = 2 * pegX): horizontal callout
      // above the top peg pair.
      from: [-pegX, pegY + DIMENSION_OFFSET],
      to: [pegX, pegY + DIMENSION_OFFSET],
      label: `${(2 * pegX).toFixed(1)} mm`,
      axis: "x",
    },
    {
      // Peg spacing Y (= 2 * pegY): vertical callout beside a peg column.
      from: [pegX + DIMENSION_OFFSET, -pegY],
      to: [pegX + DIMENSION_OFFSET, pegY],
      label: `${(2 * pegY).toFixed(1)} mm`,
      axis: "y",
    },
  ];
}

// omega board's opening widens for 4x5 → a distinct outline variant.
function boardOutlineKey(c: TwoDConfig): string | null {
  if (!c.alignmentBoard || !BOARD_CARRIERS.has(c.carrierType)) return null;
  if (c.alignmentBoardType === "omega") return c.filmFormat === "4x5" ? "omega-4x5" : "omega";
  if (c.alignmentBoardType === "lpl-saunders") return "lpl-saunders";
  if (c.alignmentBoardType === "beseler-23c") return "beseler-23c";
  return null;
}

export function buildScene(
  c: TwoDConfig,
  measure: (t: string, f: string, s: number) => number = measureTextWidthMm,
): Scene {
  const { openingHeight, openingWidth } = openingDimensions(c);
  const { x, y } = pegPositions(c);
  const { r, kind } = pegRadiusAndKind(c);
  const pegs: PegShape[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) pegs.push({ cx: sx * x, cy: sy * y, r, kind });
  if (c.carrierType === "beseler-45") {
    // Fixed corner alignment/stacking pegs (universal-carrier-assembly.scad):
    // bottom carries Ø4.6 down-only pegs; top has Ø6 stacking holes.
    const half = BESELER_45_ALIGN_PEG_SPACING / 2; // 59.85
    const corner: { r: number; kind: "peg" | "hole" } =
      c.topOrBottom === "bottom"
        ? { r: BESELER_45_ALIGN_PEG_DIAMETER / 2, kind: "peg" }        // 2.3
        : { r: BESELER_45_ALIGN_PEG_HOLE_DIAMETER / 2, kind: "hole" }; // 3
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      pegs.push({ cx: sx * half, cy: sy * half, ...corner });
  }
  return {
    // film_opening cuboid([opening_height, opening_width, …]): X=height, Y=width.
    opening: { w: openingHeight, h: openingWidth, chamfer: FILM_OPENING_FILLET },
    pegs,
    screwHoles: screwFootprint(c),
    arrow: directionalArrow(c),
    texts: textPlacements(c, measure),
    boardKey: boardOutlineKey(c),
    dimensions: dimensionAnnotations(openingHeight, openingWidth, x, y),
  };
}

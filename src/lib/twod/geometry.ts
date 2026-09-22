import type { TwoDConfig, TextPlacement, Scene, PegShape, DimensionAnnotation, RecessShape } from "./types";
import { FILM_FORMATS, isFiledFormat, filmTypeName, filmFramePitch, effectiveFrameCount } from "./film-data";
import { measureTextWidthMm, SCAD_TEXT_EM_SCALE } from "./measure-text";
import { BOARD_CARRIERS, SCREW_ON_BOARD_CARRIERS, SINGLE_PIECE_CARRIERS, FILM_PEG_CARRIERS, screwOnBoardType } from "@/config/carriers";

// Default film dimensions used by SCAD when format is "custom" and no override
// is passed — matches film-sizes.scad customFilmFormatWidth / customFilmFormatHeight.
const CUSTOM_FILM_DEFAULT_WIDTH = 37;   // film-sizes.scad customFilmFormatWidth
const CUSTOM_FILM_DEFAULT_HEIGHT = 37;  // film-sizes.scad customFilmFormatHeight

// Constants from carrier-features.scad / carrier-configs.scad.
const PEG_DIAMETER = 5.6;
const PEG_RADIUS = PEG_DIAMETER / 2;          // 2.8
const PEG_HOLE_TOLERANCE = 0.25;
// Heat-set pegs are machine screws threaded into the bottom carrier; the head
// is the peg. Thread-forming (tap-drill) hole dia per size, and the head
// diameter (ISO dk max) per head style × size — HEAT_SET_SCREW_SIZES /
// HEAT_SET_SCREW_HEADS in carrier-features.scad.
export const HEAT_SET_SCREW_SIZES: Record<string, { threadHoleDia: number }> = {
  "M2":   { threadHoleDia: 1.6 },
  "M2.5": { threadHoleDia: 2.05 },
  "M3":   { threadHoleDia: 2.5 },
};
export const HEAT_SET_SCREW_HEADS: Record<string, Record<string, number>> = {
  socket: { "M2": 3.8, "M2.5": 4.5, "M3": 5.5 },  // socket head cap, ISO 4762
  button: { "M2": 3.8, "M2.5": 4.7, "M3": 5.7 },  // button head, ISO 7380
  pan:    { "M2": 4.0, "M2.5": 5.0, "M3": 6.0 },  // pan head, ISO 7045
  cheese: { "M2": 3.8, "M2.5": 4.5, "M3": 5.5 },  // cheese head, ISO 1207
};
export const DEFAULT_HEAT_SET_SCREW_SIZE = "M2";
export const DEFAULT_HEAT_SET_SCREW_HEAD = "socket";
const HEAT_SET_HOLE_FDM_COMPENSATION = 0.3;   // added to the thread hole dia (M2 → 1.9)

function heatSetSize(size: string): string {
  return size in HEAT_SET_SCREW_SIZES ? size : DEFAULT_HEAT_SET_SCREW_SIZE;
}
/** Port of heat_set_thread_hole_dia: bottom hole the screw threads into. */
export function heatSetThreadHoleDia(c: Pick<TwoDConfig, "heatSetScrewSize" | "heatSetThreadHoleAdjust">): number {
  return HEAT_SET_SCREW_SIZES[heatSetSize(c.heatSetScrewSize)].threadHoleDia + HEAT_SET_HOLE_FDM_COMPENSATION + c.heatSetThreadHoleAdjust;
}
/** Port of heat_set_head_dia: the screw head itself (table, or the measured
 *  custom diameter). */
export function heatSetHeadDia(c: Pick<TwoDConfig, "heatSetScrewSize" | "heatSetHeadStyle" | "heatSetHeadDiameter">): number {
  if (c.heatSetHeadStyle === "custom") return c.heatSetHeadDiameter;
  const heads = HEAT_SET_SCREW_HEADS[c.heatSetHeadStyle] ?? HEAT_SET_SCREW_HEADS[DEFAULT_HEAT_SET_SCREW_HEAD];
  return heads[heatSetSize(c.heatSetScrewSize)];
}
/** Port of heat_set_head_hole_dia: top clearance around the screw head. */
export function heatSetHeadHoleDia(c: Pick<TwoDConfig, "heatSetScrewSize" | "heatSetHeadStyle" | "heatSetHeadDiameter" | "heatSetHeadHoleAdjust">): number {
  return heatSetHeadDia(c) + 2 * PEG_HOLE_TOLERANCE + c.heatSetHeadHoleAdjust;
}
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

/** Frames the opening actually spans (1 for 4x5 / custom, whatever Frame_Count says). */
export function frameCount(c: TwoDConfig): number {
  return effectiveFrameCount(c.filmFormat, c.frameCount);
}

// Port of get_multi_frame_height: the film "height" (frame length along the
// strip) grows by one frame pitch per extra frame. A filed height keeps its
// rebate reveal at the two ends only; between frames the opening shows exactly
// the true inter-frame gap.
function multiFrameHeight(c: TwoDConfig, height: number): number {
  return height + (frameCount(c) - 1) * filmFramePitch(c.filmFormat);
}

// Port of get_custom_aware_opening_* (carrier-features.scad). Returned as the
// film_opening cuboid axes: X-extent = openingHeight, Y-extent = openingWidth.
export function openingDimensions(c: TwoDConfig): { openingHeight: number; openingWidth: number } {
  if (c.filmFormat === "custom") {
    return { openingHeight: c.customOpeningHeight, openingWidth: c.customOpeningWidth };
  }
  const { height: singleHeight, width } = filmDims(c);
  const height = multiFrameHeight(c, singleHeight);
  const eff = effectiveOrientation(c);
  const calcHeight = eff === "vertical" ? height : width;
  const calcWidth = eff === "vertical" ? width : height;
  return {
    openingHeight: calcHeight + c.adjustFilmHeight,
    openingWidth: calcWidth + c.adjustFilmWidth,
  };
}

// Port of calculate_internal_peg_gap. Filed formats get FILED_PEG_EXTRA_GAP
// more clearance per side on the peg-distance axis.
const FILED_PEG_EXTRA_GAP = 0.5;
function internalPegGap(c: TwoDConfig): number {
  return isFiledFormat(c.filmFormat) ? (1 - c.pegGap) - FILED_PEG_EXTRA_GAP : (1 - c.pegGap);
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
      : { r: heatSetThreadHoleDia(c) / 2, kind: "hole" };    // M2 default: 0.95
  }
  // top
  return c.pegStyle === "printed"
    ? { r: PEG_RADIUS + PEG_HOLE_TOLERANCE, kind: "hole" }   // 3.05
    : { r: heatSetHeadHoleDia(c) / 2, kind: "hole" };        // M2 default: 2.15
}

// The single-piece glass carrier is always the bottom-style piece (carrier.scad
// forces top_or_bottom="bottom"); everything else honours the toggle.
export function effectiveTopOrBottom(c: TwoDConfig): "top" | "bottom" {
  return SINGLE_PIECE_CARRIERS.has(c.carrierType) ? "bottom" : c.topOrBottom;
}

// Board type the carrier is actually used with: screw-on carriers pin their
// own (carrier.scad forces "omega" for omega-d-glass).
export function effectiveBoardType(c: TwoDConfig): string {
  return screwOnBoardType(c.carrierType) ?? c.alignmentBoardType;
}

// Is the board fused into this carrier? Never for screw-on carriers.
function boardFused(c: TwoDConfig): boolean {
  return c.alignmentBoard && !SCREW_ON_BOARD_CARRIERS.has(c.carrierType);
}

// Port of generate_universal_alignment_footprint_holes + alignment_footprint_holes.
// Holes appear only when the board is NOT fused, so the carrier can be screwed
// onto the separately printed board. The screws must land on the BOARD's
// material, so the pattern is per board type (carrier-configs.scad
// *_BOARD_SCREW_PATTERN_DIST_*; full centre-to-centre spacing, holes at
// (±x/2, ±y/2)):
//   omega:        127mm square frame → (±41, ±56.5), on its rails. The 4x5
//                 board's widened cutout (and the 4x5 film opening) swallow
//                 that, so it uses (±56, ±40) — also the glass carrier's.
//   lpl-saunders: two chord rails at |x| = 60.5..75.4 → x = ±68 (rail centre),
//                 y = ±35 (rail spans |y| ≤ 43.5 there).
//   beseler-23c:  5mm ring at r = 55..60 → on its centre-line (r 57.5) at 45°.
// The screws are the same machine screws as the heat-set pegs, so the holes are
// the heat-set thread-forming size (heatSetThreadHoleDia; M2: 1.9 → r 0.95),
// as are the pilot holes in the separately exported board.
const BESELER_23C_BOARD_SCREW_RADIUS = 57.5;  // = the 23C board's TORUS_MAJOR_RADIUS
export const BOARD_SCREW_PATTERNS: Record<string, { distX: number; distY: number }> = {
  "omega":        { distX: 82,  distY: 113 },
  "omega-4x5":    { distX: 112, distY: 80 },
  "lpl-saunders": { distX: 136, distY: 70 },
  "beseler-23c":  { distX: BESELER_23C_BOARD_SCREW_RADIUS * Math.SQRT2, distY: BESELER_23C_BOARD_SCREW_RADIUS * Math.SQRT2 },
};

export function screwFootprint(c: TwoDConfig): { cx: number; cy: number; r: number }[] {
  if (boardFused(c) || !BOARD_CARRIERS.has(c.carrierType)) return [];
  // Keyed like the board outlines: the omega board's 4x5 variant has its own
  // pattern. The glass carrier is always that variant (carrier.scad forces it,
  // whatever the format says).
  const key = c.carrierType === "omega-d-glass" ? "omega-4x5" : boardTypeOutlineKey(c);
  const pattern = BOARD_SCREW_PATTERNS[key ?? ""];
  if (!pattern) return [];
  const ex = pattern.distX / 2;
  const ey = pattern.distY / 2;
  const r = heatSetThreadHoleDia(c) / 2;  // M2 default: 0.95
  const out: { cx: number; cy: number; r: number }[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push({ cx: sx * ex, cy: sy * ey, r });
  return out;
}

// Port of omega-d-glass-base-shape.scad: the plate pocket (plate + side play,
// 1mm inside-corner radius) and the finger notch — a circle just outside the
// pocket's short (X) edge, tangent to the long edge, reaching `notchReach`
// under the plate. The Omega-D handle is on -X, so "handle" corners are -X.
const GLASS_THICKNESS = 4;                // OMEGA_D_GLASS_THICKNESS = 2 × 2
const GLASS_POCKET_CORNER_RADIUS = 1;     // OMEGA_D_GLASS_POCKET_CORNER_RADIUS
const NOTCH_SIGNS: Record<string, [number, number]> = {
  "handle-lower": [-1, -1], "handle-upper": [-1, 1], "far-lower": [1, -1], "far-upper": [1, 1],
};

export function glassRecesses(c: TwoDConfig): RecessShape[] {
  if (c.carrierType !== "omega-d-glass") return [];
  const g = c.glass;
  const pocketW = g.plateWidth + 2 * g.sidePlay;
  const pocketL = g.plateLength + 2 * g.sidePlay;
  const out: RecessShape[] = [
    { kind: "rect", cx: 0, cy: 0, w: pocketW, h: pocketL, r: GLASS_POCKET_CORNER_RADIUS, through: false },
  ];
  const signs = NOTCH_SIGNS[g.notchCorner];
  if (g.notchDiameter > 0 && signs) {
    const r = g.notchDiameter / 2;
    out.push({
      kind: "circle",
      cx: signs[0] * (pocketW / 2 + r - g.notchReach),
      cy: signs[1] * (pocketL / 2 - r),
      r,
      through: g.notchFloor <= 0 && GLASS_THICKNESS > 0,
    });
  }
  return out;
}

// Port of _get_text_settings (carrier-configs.scad): [yTranslate, carrierEdge, edgeMargin].
function textSettings(carrierType: string): [number, number, number] {
  if (carrierType === "omega-d" || carrierType === "omega-d-glass") return [-90, 69.5, 5];
  if (carrierType === "lpl-saunders-45xx") return [-65, 85, 5];
  if (carrierType === "beseler-23c") return [-65, 60, 5];
  if (carrierType === "beseler-45") return [0, 105, 5];
  return [0, 60, 5];
}

// Port of get_text_rotation.
function textRotation(carrierType: string): number {
  if (carrierType === "omega-d" || carrierType === "omega-d-glass" || carrierType === "lpl-saunders-45xx") return 270;
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
    // carrier.scad SELECTED_TYPE_NAME: the glass carrier says so ("4X5 GLASS"),
    // unless the label is the user's own.
    const typeValue = c.typeNameSource === "Custom"
      ? c.customTypeName
      : filmTypeName(c.filmFormat, c.frameCount) + (c.carrierType === "omega-d-glass" ? " GLASS" : "");
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

// Fixed callout offsets (mm) placing a dimension line just outside the extent
// it measures. v1 keeps these constant rather than a layout heuristic. The
// opening callouts hug the opening tightly so they aren't read as peg
// measurements (with the same 6mm standoff the opening line fell right on the
// peg column for some formats); peg callouts stand further out.
const OPENING_DIMENSION_OFFSET = 3;
const PEG_DIMENSION_OFFSET = 6;

// The four v1 dimension callouts: opening X/Y extents and peg-center spacing
// X/Y. Labels report the value along the drawn axis (see the opening-axis
// convention note on buildScene below), formatted to one decimal.
function dimensionAnnotations(
  openingHeight: number, openingWidth: number, pegs: { x: number; y: number } | null,
): DimensionAnnotation[] {
  const halfH = openingHeight / 2;
  const halfW = openingWidth / 2;
  const opening: DimensionAnnotation[] = [
    {
      // Opening X extent (scene.opening.w = openingHeight): horizontal
      // callout just below the opening.
      from: [-halfH, -halfW - OPENING_DIMENSION_OFFSET],
      to: [halfH, -halfW - OPENING_DIMENSION_OFFSET],
      label: `${openingHeight.toFixed(1)} mm`,
      axis: "x",
    },
    {
      // Opening Y extent (openingWidth): vertical callout just left of the opening.
      from: [-halfH - OPENING_DIMENSION_OFFSET, -halfW],
      to: [-halfH - OPENING_DIMENSION_OFFSET, halfW],
      label: `${openingWidth.toFixed(1)} mm`,
      axis: "y",
    },
  ];
  if (!pegs) return opening;
  const { x: pegX, y: pegY } = pegs;
  return [
    ...opening,
    {
      // Peg spacing X (center-to-center = 2 * pegX): horizontal callout
      // above the top peg pair.
      from: [-pegX, pegY + PEG_DIMENSION_OFFSET],
      to: [pegX, pegY + PEG_DIMENSION_OFFSET],
      label: `${(2 * pegX).toFixed(1)} mm`,
      axis: "x",
    },
    {
      // Peg spacing Y (= 2 * pegY): vertical callout beside a peg column.
      from: [pegX + PEG_DIMENSION_OFFSET, -pegY],
      to: [pegX + PEG_DIMENSION_OFFSET, pegY],
      label: `${(2 * pegY).toFixed(1)} mm`,
      axis: "y",
    },
  ];
}

// Outline key of the board this carrier is used with, whether it's fused in
// or printed separately (the film opening must clear its cutout either way).
// omega board's opening widens for 4x5 → a distinct outline variant.
export function boardTypeOutlineKey(c: TwoDConfig): string | null {
  if (!BOARD_CARRIERS.has(c.carrierType)) return null;
  const boardType = effectiveBoardType(c);
  if (boardType === "omega") return c.filmFormat === "4x5" ? "omega-4x5" : "omega";
  if (boardType === "lpl-saunders") return "lpl-saunders";
  if (boardType === "beseler-23c") return "beseler-23c";
  return null;
}

// The board ghost is always drawn for a board carrier: fused in, or — when
// detached (screw-on or Alignment_Board off) — still printed and screwed on
// underneath, which the view marks as not attached.
function boardOutlineKey(c: TwoDConfig): string | null {
  return boardTypeOutlineKey(c);
}

export function buildScene(
  c: TwoDConfig,
  measure: (t: string, f: string, s: number) => number = measureTextWidthMm,
): Scene {
  const { openingHeight, openingWidth } = openingDimensions(c);
  // Film pegs: none on the glass carrier (its pocket locates the plate).
  const filmPegs = FILM_PEG_CARRIERS.has(c.carrierType) ? pegPositions(c) : null;
  const { r, kind } = pegRadiusAndKind(c);
  const pegs: PegShape[] = [];
  if (filmPegs) {
    const { x, y } = filmPegs;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) pegs.push({ cx: sx * x, cy: sy * y, r, kind });
  }
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
    recesses: glassRecesses(c),
    arrow: directionalArrow(c),
    texts: textPlacements(c, measure),
    boardKey: boardOutlineKey(c),
    boardAttached: boardFused(c),
    dimensions: dimensionAnnotations(openingHeight, openingWidth, filmPegs),
  };
}

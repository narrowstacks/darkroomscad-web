// Does the film opening actually fit? Multi-frame and custom openings can run
// past the carrier body, or be masked by the alignment board's own opening
// (the omega board's cross-shaped cutout is only 119×93.5 / 70×113). The SCAD
// will happily cut either; this flags it in the 2D preview instead.
//
// The carrier/board outlines (generated/*.json) are plain M/L/z polygons in the
// OpenSCAD SVG-export space (+Y screen-up = model Y negated). The opening is an
// origin-centered rectangle, so its sample points are symmetric under that
// flip and can be tested directly against the raw outline coordinates.

export type FitIssue = "body" | "board";

export type Polygon = [number, number][];

/** Wall the body must keep around the opening (mm). */
export const BODY_WALL_MARGIN = 3;
/** Spacing of perimeter sample points (mm). */
const SAMPLE_STEP = 5;

/** Parse an M/L/z-only SVG path into its subpath polygons. */
export function parsePathPolygons(d: string): Polygon[] {
  const polys: Polygon[] = [];
  let cur: Polygon | null = null;
  const tokens = d.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "M" || t === "L") {
      const [x, y] = tokens[++i].split(",").map(Number);
      if (t === "M" || !cur) { cur = []; polys.push(cur); }
      cur.push([x, y]);
    } else if (t === "z" || t === "Z") {
      cur = null;
    } else {
      throw new Error(`parsePathPolygons: unsupported path token "${t}"`);
    }
  }
  return polys.filter((p) => p.length >= 3);
}

/** Even-odd point-in-polygons test (matches the outlines' fillRule="evenodd"). */
export function pointInPolygons(polys: Polygon[], x: number, y: number): boolean {
  let inside = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Points along the perimeter of an origin-centered w×h rectangle.
function perimeterSamples(w: number, h: number): [number, number][] {
  const hw = w / 2, hh = h / 2;
  const out: [number, number][] = [];
  const nx = Math.max(1, Math.ceil(w / SAMPLE_STEP)), ny = Math.max(1, Math.ceil(h / SAMPLE_STEP));
  for (let i = 0; i <= nx; i++) {
    const x = -hw + (w * i) / nx;
    out.push([x, -hh], [x, hh]);
  }
  for (let j = 1; j < ny; j++) {
    const y = -hh + (h * j) / ny;
    out.push([-hw, y], [hw, y]);
  }
  return out;
}

/**
 * Fit issues for an opening (film_opening cuboid extents, SCAD mm) against
 * the carrier body outline and, when given, the alignment board outline.
 * - "body": some of the opening (+ wall margin) lies outside the body.
 * - "board": some of the opening lies on board material (masked).
 */
export function openingFitIssues(
  opening: { w: number; h: number },
  body: { d: string } | undefined,
  board?: { d: string },
): FitIssue[] {
  const issues: FitIssue[] = [];
  if (body) {
    const polys = parsePathPolygons(body.d);
    const walled = perimeterSamples(opening.w + 2 * BODY_WALL_MARGIN, opening.h + 2 * BODY_WALL_MARGIN);
    if (walled.some(([x, y]) => !pointInPolygons(polys, x, y))) issues.push("body");
  }
  if (board) {
    const polys = parsePathPolygons(board.d);
    if (perimeterSamples(opening.w, opening.h).some(([x, y]) => pointInPolygons(polys, x, y))) issues.push("board");
  }
  return issues;
}

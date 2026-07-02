import type { TwoDConfig } from "./types";
import { effectiveOrientation } from "./geometry";

export type FilmFamily = "135" | "120" | "sheet" | "custom" | "none";
export type TravelAxis = "x" | "y";

/** Film stock chosen for a custom format's overlay (preview-only, not a SCAD
 *  param): 35mm strip w/ sprockets, 120 roll, or a generic bordered stock. */
export type OverlayFilmType = "35mm" | "120" | "custom";

/** Preview-only spec for a custom carrier's film overlay: which stock to draw
 *  and the recorded image size to lay on it (e.g. XPan = 35mm, 65×24). */
export interface CustomFilmSpec { type: OverlayFilmType; imageWidth: number; imageHeight: number; }

/** A rectangle in trueSCAD mm coords, centered at (cx, cy). */
export interface FilmRect { cx: number; cy: number; w: number; h: number; }

export interface FilmOverlay {
  family: FilmFamily;
  travelAxis: TravelAxis;
  /** Film base rectangle, centered at origin, or null for family "none". */
  base: { w: number; h: number } | null;
  /** True recorded-image frame boundaries. */
  frames: FilmRect[];
  /** 135 perforations only; empty otherwise. */
  sprockets: FilmRect[];
}

// Physical film constants (mm). See spec 2026-07-02.
const FILM_135_WIDTH = 35;          // total 35mm film width (across)
const FILM_120_WIDTH = 61;          // 120 film base width (across); 56mm image band
const PERF_PITCH = 4.7625;          // KS perforation pitch along travel
const PERF_ALONG = 2.8;             // perf hole size along travel
const PERF_ACROSS = 2.0;            // perf hole size across
const PERF_ROW_OFFSET = 14.75;      // sprocket row center from film center (across)
const SHEET_45_LONG = 127;          // 4x5 sheet long edge (5")
const SHEET_45_SHORT = 101.6;       // 4x5 sheet short edge (4")
const GAP_135 = 2;                  // inter-frame gap (135) → 36+2 = 38mm pitch
const GAP_120 = 3;                  // inter-frame gap (120)
const GAP_CUSTOM = 2;               // inter-frame gap (generic custom stock)
const CUSTOM_STOCK_REBATE = 3;      // film border around the image for custom stock (each edge)

// True recorded image (along travel, across) in mm — NOT the carrier opening.
// Filed variants share their base image (filing reveals rebate, not more image).
const FILM_IMAGE: Record<string, { along: number; across: number }> = {
  "35mm": { along: 36, across: 24 },
  "35mm filed": { along: 36, across: 24 },
  "35mm full": { along: 36, across: 24 },
  "half frame": { along: 18, across: 24 },
  "6x4.5": { along: 41.5, across: 56 },
  "6x4.5 filed": { along: 41.5, across: 56 },
  "6x6": { along: 56, across: 56 },
  "6x6 filed": { along: 56, across: 56 },
  "6x7": { along: 70, across: 56 },
  "6x7 filed": { along: 70, across: 56 },
  "6x8": { along: 77, across: 56 },
  "6x8 filed": { along: 77, across: 56 },
  "6x9": { along: 84, across: 56 },
  "6x9 filed": { along: 84, across: 56 },
};

export function filmFamily(format: string): FilmFamily {
  if (format === "half frame" || format.startsWith("35mm")) return "135";
  if (format.startsWith("6x")) return "120";
  if (format === "4x5") return "sheet";
  return "none";
}

// Resolve the family + recorded image for a custom carrier from its overlay
// spec (preview-only). Returns null when there's nothing sensible to draw.
function resolveCustom(spec: CustomFilmSpec | undefined):
  { family: FilmFamily; img: { along: number; across: number } } | null {
  if (!spec || !(spec.imageWidth > 0) || !(spec.imageHeight > 0)) return null;
  // imageHeight runs along the strip (matches the openingHeight axis); imageWidth across.
  const img = { along: spec.imageHeight, across: spec.imageWidth };
  const family: FilmFamily = spec.type === "35mm" ? "135" : spec.type === "120" ? "120" : "custom";
  return { family, img };
}

export function buildFilmOverlay(
  c: TwoDConfig, travelExtent: number, custom?: CustomFilmSpec,
): FilmOverlay {
  const travelAxis: TravelAxis = effectiveOrientation(c) === "vertical" ? "x" : "y";

  // Resolve which family + image to draw. Standard formats read the built-in
  // FILM_IMAGE table; custom formats read the preview-only spec.
  let family: FilmFamily;
  let img: { along: number; across: number } | null = null;
  if (c.filmFormat === "custom") {
    const resolved = resolveCustom(custom);
    family = resolved?.family ?? "none";
    img = resolved?.img ?? null;
  } else {
    family = filmFamily(c.filmFormat);
    // filmFamily classifies by prefix ("35mm*", "6x*") but FILM_IMAGE is keyed
    // exactly; an unknown-but-prefix-matching format (e.g. "6x12" via a share
    // link or localStorage) has no image entry. Degrade rather than throw.
    if (family === "135" || family === "120") img = FILM_IMAGE[c.filmFormat] ?? null;
  }

  const empty: FilmOverlay = { family, travelAxis, base: null, frames: [], sprockets: [] };
  if (family === "none") return empty;

  // Place a rect given its position/size along the travel and across axes.
  const rect = (along: number, across: number, alongLen: number, acrossLen: number): FilmRect =>
    travelAxis === "x"
      ? { cx: along, cy: across, w: alongLen, h: acrossLen }
      : { cx: across, cy: along, w: acrossLen, h: alongLen };
  const baseRect = (alongLen: number, acrossLen: number) =>
    travelAxis === "x" ? { w: alongLen, h: acrossLen } : { w: acrossLen, h: alongLen };

  if (family === "sheet") {
    // Single 4x5 sheet, long edge along travel.
    return { ...empty, base: baseRect(SHEET_45_LONG, SHEET_45_SHORT) };
  }
  if (!img) return empty;

  // Film stock width across + inter-frame gap by family. The generic "custom"
  // stock wraps the image in a small rebate border and carries no sprockets.
  const filmWidth =
    family === "135" ? FILM_135_WIDTH :
    family === "120" ? FILM_120_WIDTH :
    img.across + 2 * CUSTOM_STOCK_REBATE;
  const gap = family === "135" ? GAP_135 : family === "120" ? GAP_120 : GAP_CUSTOM;
  const pitch = img.along + gap;

  const base = baseRect(2 * travelExtent, filmWidth);

  const frames: FilmRect[] = [];
  const nFrames = Math.ceil(travelExtent / pitch);
  for (let k = -nFrames; k <= nFrames; k++) frames.push(rect(k * pitch, 0, img.along, img.across));

  const sprockets: FilmRect[] = [];
  if (family === "135") {
    const nPerf = Math.ceil(travelExtent / PERF_PITCH);
    for (const side of [-1, 1]) {
      for (let m = -nPerf; m <= nPerf; m++) {
        sprockets.push(rect(m * PERF_PITCH, side * PERF_ROW_OFFSET, PERF_ALONG, PERF_ACROSS));
      }
    }
  }

  return { family, travelAxis, base, frames, sprockets };
}

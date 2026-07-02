import type { TwoDConfig } from "./types";
import { effectiveOrientation } from "./geometry";

export type FilmFamily = "135" | "120" | "sheet" | "none";
export type TravelAxis = "x" | "y";

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

export function buildFilmOverlay(c: TwoDConfig, travelExtent: number): FilmOverlay {
  const family = filmFamily(c.filmFormat);
  const travelAxis: TravelAxis = effectiveOrientation(c) === "vertical" ? "x" : "y";
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

  const img = FILM_IMAGE[c.filmFormat];
  const filmWidth = family === "135" ? FILM_135_WIDTH : FILM_120_WIDTH;
  const gap = family === "135" ? GAP_135 : GAP_120;
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

export interface FilmFormat {
  height: number; width: number; pegDistance: number; typeName: string;
  /** Center-to-center frame spacing along the strip (image + inter-frame gap);
   *  0 for single-frame-only formats (4x5 sheets). Port of _FF_FRAME_PITCH. */
  framePitch: number;
}

// Port of film-sizes.scad frame-pitch constants.
const FRAME_PITCH_135 = 38;         // 8 perforations × 4.75mm
const FRAME_PITCH_HALF_FRAME = 19;  // 4 perforations
const FRAME_GAP_120 = 3;            // typical 120 inter-frame gap

// Port of FILM_FORMATS in film-sizes.scad: [height, width, pegDistance, typeName, framePitch].
// pegDistance = actual stock width (35 / 61.5 / 101.6) + 2.5; the peg calc
// subtracts 1 per side back, leaving the pegs' inner faces 0.25mm outside the
// film edge (= PEG_HOLE_TOLERANCE, so the top's oversized hole clears too).
// Filed variants share the unfiled pitch (filing reveals rebate; it doesn't
// move the frames).
export const FILM_FORMATS: Record<string, FilmFormat> = {
  "35mm":        { height: 36,   width: 24, pegDistance: 37.5, typeName: "35MM", framePitch: FRAME_PITCH_135 },
  "35mm filed":  { height: 40,   width: 28, pegDistance: 37.5, typeName: "FILED35", framePitch: FRAME_PITCH_135 },
  "half frame":  { height: 18,   width: 24, pegDistance: 37.5, typeName: "HALF", framePitch: FRAME_PITCH_HALF_FRAME },
  "half frame filed": { height: 21, width: 28, pegDistance: 37.5, typeName: "FILEDHALF", framePitch: FRAME_PITCH_HALF_FRAME },
  "6x4.5":       { height: 41.5, width: 56, pegDistance: 64,   typeName: "6x4.5", framePitch: 41.5 + FRAME_GAP_120 },
  "6x4.5 filed": { height: 43.5, width: 58, pegDistance: 64,   typeName: "F6x4.5", framePitch: 41.5 + FRAME_GAP_120 },
  "6x6":         { height: 56,   width: 56, pegDistance: 64,   typeName: "6x6", framePitch: 56 + FRAME_GAP_120 },
  "6x6 filed":   { height: 58,   width: 58, pegDistance: 64,   typeName: "F6x6", framePitch: 56 + FRAME_GAP_120 },
  "6x7":         { height: 70,   width: 56, pegDistance: 64,   typeName: "6x7", framePitch: 70 + FRAME_GAP_120 },
  "6x7 filed":   { height: 72,   width: 58, pegDistance: 64,   typeName: "F6x7", framePitch: 70 + FRAME_GAP_120 },
  "6x8":         { height: 77,   width: 56, pegDistance: 64,   typeName: "6x8", framePitch: 77 + FRAME_GAP_120 },
  "6x8 filed":   { height: 79,   width: 58, pegDistance: 64,   typeName: "F6x8", framePitch: 77 + FRAME_GAP_120 },
  "6x9":         { height: 84,   width: 56, pegDistance: 64,   typeName: "6x9", framePitch: 84 + FRAME_GAP_120 },
  "6x9 filed":   { height: 86,   width: 58, pegDistance: 64,   typeName: "F6x9", framePitch: 84 + FRAME_GAP_120 },
  "4x5":         { height: 120,  width: 95, pegDistance: 104.1, typeName: "4X5", framePitch: 0 },
};

const FILED = new Set([
  "35mm filed", "half frame filed", "6x4.5 filed", "6x6 filed", "6x7 filed", "6x8 filed", "6x9 filed",
]);

export function isFiledFormat(format: string): boolean {
  return FILED.has(format);
}

/** Port of get_film_format_frame_pitch: 0 for 4x5, custom, and unknown formats. */
export function filmFramePitch(format: string): number {
  return FILM_FORMATS[format]?.framePitch ?? 0;
}

/** Port of get_effective_frame_count: formats without a pitch (4x5, custom)
 *  always render as a single frame, whatever Frame_Count says. */
export function effectiveFrameCount(format: string, frameCount: number): number {
  return filmFramePitch(format) > 0 && frameCount > 1 ? frameCount : 1;
}

/** Port of get_film_format_type_name: multi-frame openings get an " X<n>" suffix. */
export function filmTypeName(format: string, frameCount = 1): string {
  const base = FILM_FORMATS[format]?.typeName ?? (format === "custom" ? "CUSTOM" : format);
  const n = effectiveFrameCount(format, frameCount);
  return n > 1 ? `${base} X${n}` : base;
}

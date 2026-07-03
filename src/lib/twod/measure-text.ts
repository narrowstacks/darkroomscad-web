// Approximate OpenSCAD's textmetrics() using the browser canvas. Sub-mm
// differences from FreeType are expected and accepted (the 3D view is the ground
// truth). SSR / jsdom have no canvas → deterministic fallback estimates.
//
// OpenSCAD size convention (measured against the vendored WASM engine):
// text(size=s) is rendered by FreeType as an s-point face at 100 dpi, so the
// actual em is s * 100/72 ≈ 1.389 × s. Callers that want to match the SCAD
// output must measure AND render at fontSize * SCAD_TEXT_EM_SCALE.
export const SCAD_TEXT_EM_SCALE = 100 / 72;

const FALLBACK_EM_RATIO = 0.6; // advance width per character (≈ Liberation Mono)
const FALLBACK_CAP_RATIO = 0.66; // ink height of an all-caps label (≈ cap height)

let cachedCtx: CanvasRenderingContext2D | null | undefined;

function getCtx(): CanvasRenderingContext2D | null {
  if (cachedCtx !== undefined) return cachedCtx;
  try {
    cachedCtx = typeof document !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  } catch {
    cachedCtx = null;
  }
  return cachedCtx;
}

function inkMetrics(text: string, fontFace: string, fontSize: number): TextMetrics | null {
  const ctx = getCtx();
  if (!ctx) return null;
  ctx.font = `${fontSize}px "${fontFace}"`;
  return ctx.measureText(text);
}

export function estimateTextWidthMm(text: string, _fontFace: string, fontSize: number): number {
  return text ? text.length * fontSize * FALLBACK_EM_RATIO : 0;
}

// Width of the string's ink bounding box — the counterpart of OpenSCAD
// textmetrics().size[0], which calculate_text_position uses for the
// edge-margin placement. Falls back to the advance width, then the estimate.
export function measureTextWidthMm(text: string, fontFace: string, fontSize: number): number {
  if (!text) return 0;
  const m = inkMetrics(text, fontFace, fontSize);
  if (m) {
    const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (Number.isFinite(ink) && ink > 0) return ink;
    if (m.width > 0) return m.width;
  }
  return estimateTextWidthMm(text, fontFace, fontSize);
}

// OpenSCAD valign="center" centers the string's ink bbox on the anchor, which
// puts the baseline (inkAscent - inkDescent) / 2 BELOW the anchor. Returned in
// SVG y-down convention: render <text y={shift}> with the default alphabetic
// baseline (dominantBaseline="central" would center the em box instead — ~1mm
// high for all-caps labels).
export function estimateBaselineShiftMm(text: string, _fontFace: string, fontSize: number): number {
  return text ? (fontSize * FALLBACK_CAP_RATIO) / 2 : 0;
}

export function measureBaselineShiftMm(text: string, fontFace: string, fontSize: number): number {
  if (!text) return 0;
  const m = inkMetrics(text, fontFace, fontSize);
  if (m) {
    const shift = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    if (Number.isFinite(shift)) return shift;
  }
  return estimateBaselineShiftMm(text, fontFace, fontSize);
}

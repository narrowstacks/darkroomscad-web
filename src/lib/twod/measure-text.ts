// Approximate OpenSCAD's textmetrics() width using the browser canvas. Sub-mm
// differences from FreeType are expected and accepted (the 3D view is the ground
// truth). SSR / jsdom have no canvas → deterministic fallback estimate.
const FALLBACK_EM_RATIO = 0.6;

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

export function measureTextWidthMm(text: string, fontFace: string, fontSize: number): number {
  if (!text) return 0;
  const ctx = getCtx();
  if (ctx) {
    ctx.font = `${fontSize}px "${fontFace}"`;
    const w = ctx.measureText(text).width;
    if (w > 0) return w;
  }
  return text.length * fontSize * FALLBACK_EM_RATIO;
}

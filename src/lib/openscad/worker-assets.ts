import type { FsFile } from "./render";
import type { RenderTarget } from "./preview-engine";
import { BUNDLED_FONTS, DEFAULT_FONT_FAMILY } from "@/config/fonts";

// family -> "/fonts/<file>" for every bundled face.
const FONT_PATH_BY_FAMILY = new Map<string, string>(
  BUNDLED_FONTS.map((f) => [f.family, `/fonts/${f.file}`]),
);
// Every bundled TTF path (the filterable font binaries; support files like
// fonts.conf are NOT in here and are always kept).
const BUNDLED_TTF_PATHS = new Set<string>(FONT_PATH_BY_FAMILY.values());

// Per-render FS mount filter. SCAD sources + BOSL2 always mount (includes are
// resolved by OpenSCAD at parse time — do not try to trace them).
//
// /base-stls files mount only when the target's params actually reference them;
// the parametric path references none.
//
// /fonts is filtered to the faces the render can reference: the requested
// Fontface, the default fallback face, and any non-TTF support file (e.g.
// fonts.conf, which fontconfig needs to resolve any family at all). A wrong
// font filter does not error — OpenSCAD silently falls back to another face and
// changes the text geometry — so keep this conservative.
export function filesForTarget(files: FsFile[], target: RenderTarget): FsFile[] {
  const referencedStls = new Set<string>();
  for (const v of Object.values(target.params)) {
    if (typeof v === "string" && v.startsWith("/base-stls/")) referencedStls.add(v);
  }

  const keepFonts = new Set<string>();
  const defaultFont = FONT_PATH_BY_FAMILY.get(DEFAULT_FONT_FAMILY);
  if (defaultFont) keepFonts.add(defaultFont);
  const requested = target.params.Fontface;
  if (typeof requested === "string") {
    const p = FONT_PATH_BY_FAMILY.get(requested);
    if (p) keepFonts.add(p);
  }

  return files.filter((f) => {
    if (f.path.startsWith("/base-stls/")) return referencedStls.has(f.path);
    if (f.path.startsWith("/fonts/")) {
      // Keep support files (anything that isn't a bundled TTF binary) always;
      // among TTFs keep only the referenced / default faces.
      if (!BUNDLED_TTF_PATHS.has(f.path)) return true;
      return keepFonts.has(f.path);
    }
    return true;
  });
}

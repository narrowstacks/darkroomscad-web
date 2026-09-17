import type { RenderParams } from "../openscad/types";
import { effectiveFrameCount } from "@/lib/twod/film-data";

// Film-format segment of an export filename: the format name with whitespace
// collapsed ("35mm filed" -> "35mm-filed"), plus "-x<n>" when the opening spans
// n frames (only for formats where Frame_Count applies — 4x5 never gets one).
export function formatSlug(form: RenderParams): string {
  const format = String(form.Film_Format ?? "format");
  const n = effectiveFrameCount(format, Number(form.Frame_Count ?? 1));
  const base = format.trim().replace(/\s+/g, "-");
  return n > 1 ? `${base}-x${n}` : base;
}

import type { RenderParams } from "../openscad/types";

// Controlled enum values (carrier type, film format) only need whitespace
// collapsed — e.g. "35mm filed" -> "35mm-filed".
function slug(s: string): string {
  return s.trim().replace(/\s+/g, "-");
}

// User-entered free text (preset names, owner name) can contain anything, so
// keep it filesystem-safe: collapse whitespace, drop disallowed characters,
// and tidy up stray dashes.
function sanitize(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The descriptive tail: "<carrier>_<format>", where format is the film-format
// name, or for custom sizes the actual film dimensions (e.g. "60mmX45mm").
function carrierAndFormat(form: RenderParams): string {
  const carrier = slug(String(form.Carrier_Type ?? "carrier"));
  if (form.Film_Format === "custom") {
    const w = Number(form.Custom_Film_Width);
    const h = Number(form.Custom_Film_Height);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return `${carrier}_custom`;
    return `${carrier}_${w}mmX${h}mm`;
  }
  return `${carrier}_${slug(String(form.Film_Format ?? "format"))}`;
}

/**
 * Build the download filename for the carrier ZIP.
 *
 * Prefix segments, in order, each included only when present:
 *  - the loaded, unchanged preset's name (pass `presetName` only in that case)
 *  - the owner-name text, when "Etch a name" is on and the field is non-empty
 * followed by "<carrier>_<format>" (or "<carrier>_<W>mmX<H>mm" for custom sizes).
 *
 * Examples:
 *  - "MyPreset_AARON_omega-d_35mm-filed.zip" (preset + name)
 *  - "AARON_omega-d_35mm-filed.zip"          (name only)
 *  - "omega-d_60mmX45mm.zip"                  (custom size, no preset/name)
 */
export function zipFileName(form: RenderParams, presetName?: string): string {
  const parts: string[] = [];

  const preset = sanitize(presetName ?? "");
  if (preset) parts.push(preset);

  const owner = form.Enable_Owner_Name_Etch === true
    ? sanitize(String(form.Owner_Name ?? ""))
    : "";
  if (owner) parts.push(owner);

  parts.push(carrierAndFormat(form));
  return `${parts.join("_")}.zip`;
}

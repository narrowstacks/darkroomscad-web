import type { FormValue } from "../form/types";
import type { Preset } from "../storage/presets-store";

/**
 * Serialize the current carrier config as a one-preset file in the same shape
 * as "Export presets" (`Preset[]`), so the file dropped into a ZIP can be
 * re-imported via "Import presets…" (merged by name, id regenerated on import).
 */
export function presetFileJson(name: string, values: Record<string, FormValue>): string {
  const preset: Preset = { id: "export", name, values };
  return JSON.stringify([preset], null, 2);
}

import type { FormValue } from "../form/types";
import { safeGet, safeSet } from "./local-storage";

const PRESETS_KEY = "darkroomscad:presets:v1";

export interface Preset {
  id: string;
  name: string;
  values: Record<string, FormValue>;
}

function isPreset(p: unknown): p is Preset {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o.id === "string"
    && typeof o.name === "string"
    && !!o.values && typeof o.values === "object" && !Array.isArray(o.values);
}

export function parsePresets(raw: string | null): Preset[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(arr) ? arr.filter(isPreset) : [];
}

// Add a new preset, or overwrite the existing one with the same name
// (case-insensitive, trimmed). Pure — the caller supplies the id.
export function upsertPreset(
  list: Preset[],
  name: string,
  values: Record<string, FormValue>,
  id: string,
): Preset[] {
  const trimmed = name.trim();
  const existing = list.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return list.map((p) => (p.id === existing.id ? { ...p, values } : p));
  return [...list, { id, name: trimmed, values }];
}

export function deletePreset(list: Preset[], id: string): Preset[] {
  return list.filter((p) => p.id !== id);
}

export function loadPresets(): Preset[] {
  return parsePresets(safeGet(PRESETS_KEY));
}

export function savePresets(list: Preset[]): void {
  safeSet(PRESETS_KEY, JSON.stringify(list));
}

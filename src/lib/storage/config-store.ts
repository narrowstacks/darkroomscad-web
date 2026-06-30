import type { FormValue } from "../form/types";
import { safeGet, safeSet } from "./local-storage";

const CONFIG_KEY = "darkroomscad:config:v1";

function isFormValue(v: unknown): v is FormValue {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

// Parse a stored config blob into a values map, keeping only known params with
// primitive values. Tolerates null/corrupt input and stale keys (params that no
// longer exist after a schema change) so persistence survives upgrades.
export function parseStoredValues(
  raw: string | null,
  knownKeys: Set<string>,
): Record<string, FormValue> {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, FormValue> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (knownKeys.has(k) && isFormValue(v)) out[k] = v;
  }
  return out;
}

export function serializeValues(values: Record<string, FormValue>): string {
  return JSON.stringify(values);
}

export function loadConfig(knownKeys: Set<string>): Record<string, FormValue> {
  return parseStoredValues(safeGet(CONFIG_KEY), knownKeys);
}

export function saveConfig(values: Record<string, FormValue>): void {
  safeSet(CONFIG_KEY, serializeValues(values));
}

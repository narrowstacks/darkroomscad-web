import type { FormValue } from "@/lib/form/types";

export const PERMALINK_VERSION = 1;
export const MAX_PAYLOAD_CHARS = 4096;

function isFormValue(v: unknown): v is FormValue {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function base64UrlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(payload: string): string {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Diff current values against the seed; encode { v, values } as base64url. */
export function encodeShare(
  values: Record<string, FormValue>,
  seed: Record<string, FormValue>,
): string {
  const diff: Record<string, FormValue> = {};
  for (const [k, v] of Object.entries(values)) {
    if (seed[k] !== v) diff[k] = v;
  }
  const json = JSON.stringify({ v: PERMALINK_VERSION, values: diff });
  return base64UrlEncode(json);
}

/**
 * Decode a #c= payload. Returns null on: oversize, bad base64/JSON, wrong
 * version, non-object values. Filters entries to primitive FormValues.
 * Never throws on hostile input.
 */
export function decodeShare(payload: string): Record<string, FormValue> | null {
  if (typeof payload !== "string" || payload.length === 0 || payload.length > MAX_PAYLOAD_CHARS) {
    return null;
  }
  try {
    const json = base64UrlDecode(payload);
    const obj: unknown = JSON.parse(json);
    if (!obj || typeof obj !== "object") return null;
    const { v, values } = obj as { v?: unknown; values?: unknown };
    if (v !== PERMALINK_VERSION) return null;
    if (!values || typeof values !== "object" || Array.isArray(values)) return null;
    const out: Record<string, FormValue> = {};
    for (const [k, val] of Object.entries(values as Record<string, unknown>)) {
      if (isFormValue(val)) out[k] = val;
    }
    return out;
  } catch {
    return null;
  }
}

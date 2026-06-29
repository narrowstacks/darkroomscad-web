import type { RenderParams } from "./types";

export function buildParamSetJson(params: RenderParams, setName: string): string {
  const stringified: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    stringified[key] = typeof value === "string" ? value : String(value);
  }
  return JSON.stringify({
    fileFormatVersion: "1",
    parameterSets: { [setName]: stringified },
  });
}

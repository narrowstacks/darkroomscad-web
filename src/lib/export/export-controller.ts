import { zipSync } from "fflate";
import { enumerateParts } from "./part-enumeration";
import type { RenderParams, RenderResult } from "../openscad/types";

export interface ExportProgress { done: number; total: number; current: string }
export interface ExportedPart { name: string; stl: Uint8Array }
export interface ExportResult { parts: ExportedPart[]; skipped: string[] }

interface RenderLike {
  render(req: { params: RenderParams; quality: "preview" | "final" }): Promise<RenderResult>;
}

export function isEmptyStlError(err: unknown): boolean {
  return err instanceof Error && /empty \(degenerate\) STL|produced no output/i.test(err.message);
}

export async function renderParts(
  client: RenderLike,
  form: RenderParams,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const jobs = enumerateParts(form);
  const parts: ExportedPart[] = [];
  const skipped: string[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    onProgress?.({ done: i, total: jobs.length, current: job.name });
    try {
      const res = await client.render({ params: job.params, quality: "final" });
      parts.push({ name: job.name, stl: res.stl });
    } catch (err) {
      if (isEmptyStlError(err)) skipped.push(job.name);
      else throw err;
    }
  }
  onProgress?.({ done: jobs.length, total: jobs.length, current: "" });
  return { parts, skipped };
}

export function zipParts(parts: ExportedPart[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const p of parts) entries[p.name] = p.stl;
  return zipSync(entries);
}

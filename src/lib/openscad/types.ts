export type RenderQuality = "preview" | "final";

export interface RenderParams {
  [name: string]: string | number | boolean;
}

export interface RenderRequest {
  params: RenderParams;
  quality: RenderQuality;
  mainFile?: string; // default "carrier.scad"
}

export interface RenderResult {
  stl: Uint8Array;
  log: string;
  durationMs: number;
}

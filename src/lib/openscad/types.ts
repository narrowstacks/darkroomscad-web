export type RenderQuality = "preview" | "final";

export interface RenderParams {
  [name: string]: string | number | boolean;
}

export interface RenderRequest {
  params: RenderParams;
  quality: RenderQuality;
  mainFile?: string; // default "carrier.scad"
  // Preview only: prefer the fast baked-base path when the config supports it.
  // Defaults to true; set false to force the exact parametric render (for A/B compare).
  preferBaked?: boolean;
}

export type RenderEngine = "baked" | "parametric";

export interface RenderResult {
  stl: Uint8Array;
  log: string;
  durationMs: number;
  engine?: RenderEngine; // which path actually produced this STL
}

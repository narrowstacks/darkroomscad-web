import type { RenderEngine, RenderParams, RenderResult } from "./types";

export interface PreviewState {
  status: "idle" | "rendering" | "done" | "error";
  stl?: Uint8Array;
  error?: string;
  durationMs?: number;
  engine?: RenderEngine;
}

interface RenderLike {
  render(req: { params: RenderParams; quality: "preview" | "final"; preferBaked?: boolean }): Promise<RenderResult>;
}

export class PreviewController {
  private client: RenderLike;
  private debounceMs: number;
  private onState: (s: PreviewState) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;       // increments per render started
  private inFlight = false;
  private pending: RenderParams | null = null;  // newest params awaiting an idle client
  private disposed = false;
  private lastStl: Uint8Array | undefined;

  constructor(client: RenderLike, opts: { debounceMs?: number; onState: (s: PreviewState) => void }) {
    this.client = client;
    this.debounceMs = opts.debounceMs ?? 400;
    this.onState = opts.onState;
  }

  request(params: RenderParams): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.start(params);
    }, this.debounceMs);
  }

  private start(params: RenderParams): void {
    if (this.inFlight) { this.pending = params; return; }  // coalesce: remember newest
    this.inFlight = true;
    const gen = ++this.generation;
    this.onState({ status: "rendering", stl: this.lastStl });
    // Preview always prefers the fast baked path; the worker falls back to the exact
    // parametric render for configs without baked geometry.
    this.client.render({ params, quality: "preview" }).then(
      (res) => this.settle(gen, () => { this.lastStl = res.stl; this.onState({ status: "done", stl: res.stl, durationMs: res.durationMs, engine: res.engine }); }),
      (err) => this.settle(gen, () => this.onState({ status: "error", error: (err as Error).message })),
    );
  }

  private settle(gen: number, apply: () => void): void {
    this.inFlight = false;
    // `gen === this.generation` is a safety net: the `inFlight` mutex serializes
    // renders, so newest-wins is achieved by sequencing (only the latest `pending`
    // render ever starts), not by dropping a stale in-flight result. The guard would
    // only ever fire if concurrent renders were introduced. `!this.disposed` is the
    // load-bearing guard — it stops a late-resolving render from emitting after dispose.
    if (gen === this.generation && !this.disposed) apply();
    if (this.pending && !this.disposed) {
      const next = this.pending;
      this.pending = null;
      this.start(next);
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.pending = null;
  }
}

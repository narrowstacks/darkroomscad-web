import { selectRenderTarget } from "./preview-engine";
import type { RenderRequest, RenderResult } from "./types";

type Pending = {
  resolve: (r: RenderResult) => void;
  reject: (e: Error) => void;
};

export interface RenderFallback {
  render(req: RenderRequest): Promise<RenderResult>;
}

// The RangeError JavaScriptCore throws when the OpenSCAD wasm recursion outgrows a
// worker thread's native stack. Chrome never hits it; Safari does on every
// parametric (carrier.scad) render, while the page's main thread has stack to spare.
export function isStackOverflowError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Maximum call stack size exceeded|stack overflow/i.test(msg);
}

// Let React paint (export progress, "rendering" state) before a main-thread render
// blocks the page for a few seconds.
async function yieldToPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return;
  await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

export class RenderClient {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private fallback: RenderFallback | null;
  // Once a worker render has overflowed, the parametric path is sent straight to the
  // fallback; the baked preview path keeps using the worker (it never overflows) so
  // live previews stay off the main thread.
  private workerOverflowed = false;

  constructor(worker: Worker, opts: { fallback?: RenderFallback } = {}) {
    this.worker = worker;
    this.fallback = opts.fallback ?? null;
    this.worker.onmessage = (e: MessageEvent) => {
      const { type, id, result, message } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (type === "result") p.resolve(result as RenderResult);
      else p.reject(new Error(message ?? "Render failed"));
    };
  }

  async render(req: RenderRequest): Promise<RenderResult> {
    if (this.fallback && this.workerOverflowed && !selectRenderTarget(req).baked) {
      return this.renderOnFallback(req);
    }
    try {
      return await this.renderOnWorker(req);
    } catch (err) {
      if (!this.fallback || !isStackOverflowError(err)) throw err;
      this.workerOverflowed = true;
      console.warn("OpenSCAD worker overflowed its stack (Safari); rendering on the main thread instead.");
      return this.renderOnFallback(req);
    }
  }

  private async renderOnFallback(req: RenderRequest): Promise<RenderResult> {
    await yieldToPaint();
    return this.fallback!.render(req);
  }

  private renderOnWorker(req: RenderRequest): Promise<RenderResult> {
    const id = this.nextId++;
    return new Promise<RenderResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "render", id, req });
    });
  }

  dispose() {
    this.worker.terminate();
    for (const p of this.pending.values()) {
      p.reject(new Error("RenderClient disposed"));
    }
    this.pending.clear();
  }
}

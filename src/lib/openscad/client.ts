import type { RenderRequest, RenderResult } from "./types";

type Pending = {
  resolve: (r: RenderResult) => void;
  reject: (e: Error) => void;
};

export class RenderClient {
  private worker: Worker;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.onmessage = (e: MessageEvent) => {
      const { type, id, result, message } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (type === "result") p.resolve(result as RenderResult);
      else p.reject(new Error(message ?? "Render failed"));
    };
  }

  render(req: RenderRequest): Promise<RenderResult> {
    const id = this.nextId++;
    return new Promise<RenderResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: "render", id, req });
    });
  }

  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
}

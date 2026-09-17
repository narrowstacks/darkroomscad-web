/// <reference lib="webworker" />
import { createRenderEngine } from "./engine";
import type { RenderRequest, RenderResult } from "./types";

declare const self: DedicatedWorkerGlobalScope;

const engine = createRenderEngine();

self.onmessage = async (e: MessageEvent) => {
  const { type, id, req } = e.data as { type: string; id: number; req: RenderRequest };
  if (type !== "render") return;
  try {
    const result: RenderResult = await engine.render(req);
    self.postMessage({ type: "result", id, result }, [result.stl.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id, message: `${(err as Error).message}` });
  }
};

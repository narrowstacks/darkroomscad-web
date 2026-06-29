import { describe, it, expect, vi } from "vitest";
import { RenderClient } from "./client";

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  posted: any[] = [];
  postMessage(msg: any) {
    this.posted.push(msg);
    // Echo a successful result on the next tick.
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: "result",
          id: msg.id,
          result: { stl: new Uint8Array([1]), log: "", durationMs: 1 },
        },
      } as MessageEvent);
    });
  }
  terminate = vi.fn();
}

describe("RenderClient", () => {
  it("resolves render() with the worker's result for the matching id", async () => {
    const worker = new FakeWorker();
    const client = new RenderClient(worker as unknown as Worker);
    const result = await client.render({ params: { Owner_Name: "X" }, quality: "preview" });
    expect(result.stl).toEqual(new Uint8Array([1]));
    expect(worker.posted[0].type).toBe("render");
  });

  it("rejects render() when the worker posts an error for the matching id", async () => {
    class ErrorWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage(msg: any) {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "error", id: msg.id, message: "boom" } } as MessageEvent);
        });
      }
      terminate() {}
    }
    const client = new RenderClient(new ErrorWorker() as unknown as Worker);
    await expect(client.render({ params: {}, quality: "preview" })).rejects.toThrow("boom");
  });
});

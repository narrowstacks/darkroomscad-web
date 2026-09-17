import { describe, it, expect, vi } from "vitest";
import { RenderClient } from "./client";
import type { RenderResult } from "./types";

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

describe("RenderClient main-thread fallback", () => {
  const OVERFLOW = "OpenSCAD render threw: Maximum call stack size exceeded.";
  const ok = (tag: number): RenderResult => ({ stl: new Uint8Array([tag]), log: "", durationMs: 1 });

  // A worker that overflows on parametric renders (carrier.scad) and succeeds on the
  // baked preview path — exactly what Safari does.
  class SafariWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    posted: any[] = [];
    postMessage(msg: any) {
      this.posted.push(msg);
      const baked = msg.req.quality === "preview";
      queueMicrotask(() => {
        this.onmessage?.({
          data: baked
            ? { type: "result", id: msg.id, result: ok(1) }
            : { type: "error", id: msg.id, message: OVERFLOW },
        } as MessageEvent);
      });
    }
    terminate() {}
  }

  it("retries a stack-overflowed render on the fallback, then routes parametric renders straight to it", async () => {
    const worker = new SafariWorker();
    const fallback = { render: vi.fn().mockResolvedValue(ok(2)) };
    const client = new RenderClient(worker as unknown as Worker, { fallback });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const final = await client.render({ params: {}, quality: "final" });
    expect(final.stl).toEqual(new Uint8Array([2]));
    expect(worker.posted).toHaveLength(1);
    expect(fallback.render).toHaveBeenCalledTimes(1);

    // Second parametric render: no worker round-trip at all.
    await client.render({ params: {}, quality: "final" });
    expect(worker.posted).toHaveLength(1);
    expect(fallback.render).toHaveBeenCalledTimes(2);

    // Baked preview still goes to the worker.
    const preview = await client.render({ params: { Carrier_Type: "omega-d" }, quality: "preview" });
    expect(preview.stl).toEqual(new Uint8Array([1]));
    expect(worker.posted).toHaveLength(2);
    expect(fallback.render).toHaveBeenCalledTimes(2);
  });

  it("rethrows a stack overflow when no fallback is configured", async () => {
    const client = new RenderClient(new SafariWorker() as unknown as Worker);
    await expect(client.render({ params: {}, quality: "final" })).rejects.toThrow(/Maximum call stack/);
  });

  it("does not use the fallback for other worker errors", async () => {
    class ErrorWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage(msg: any) {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "error", id: msg.id, message: "OpenSCAD exited with code 1." } } as MessageEvent);
        });
      }
      terminate() {}
    }
    const fallback = { render: vi.fn() };
    const client = new RenderClient(new ErrorWorker() as unknown as Worker, { fallback });
    await expect(client.render({ params: {}, quality: "final" })).rejects.toThrow(/code 1/);
    expect(fallback.render).not.toHaveBeenCalled();
  });
});

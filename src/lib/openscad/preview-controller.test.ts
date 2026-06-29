import { describe, it, expect, vi } from "vitest";
import { PreviewController } from "./preview-controller";
import type { RenderResult } from "./types";

function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const result = (stl: number[]): RenderResult => ({ stl: new Uint8Array(stl), log: "", durationMs: 1 });

describe("PreviewController", () => {
  it("debounces rapid requests into a single render", async () => {
    vi.useFakeTimers();
    const render = vi.fn().mockResolvedValue(result([1]));
    const states: string[] = [];
    const ctl = new PreviewController({ render }, { debounceMs: 100, onState: (s) => states.push(s.status) });
    ctl.request({ A: 1 }); ctl.request({ A: 2 }); ctl.request({ A: 3 });
    expect(render).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0].params).toEqual({ A: 3 }); // latest wins
    vi.useRealTimers();
  });

  it("drops a stale result when a newer render supersedes it", async () => {
    vi.useFakeTimers();
    const d1 = deferred<RenderResult>();
    const d2 = deferred<RenderResult>();
    const render = vi.fn()
      .mockReturnValueOnce(d1.promise)
      .mockReturnValueOnce(d2.promise);
    let last: Uint8Array | undefined;
    const ctl = new PreviewController({ render }, { debounceMs: 0, onState: (s) => { if (s.stl) last = s.stl; } });
    ctl.request({ n: 1 });
    await vi.advanceTimersByTimeAsync(0);          // fires render #1 (in flight)
    ctl.request({ n: 2 });                          // newest pending while #1 in flight
    d1.resolve(result([11]));                        // #1 settles -> stale path + fires #2
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(0);
    d2.resolve(result([22]));                        // #2 settles -> applied
    await Promise.resolve();
    expect(last).toEqual(new Uint8Array([22]));      // never [11]
    vi.useRealTimers();
  });

  it("reports error state when a render rejects", async () => {
    vi.useFakeTimers();
    const render = vi.fn().mockRejectedValue(new Error("boom"));
    let errState: string | undefined;
    const ctl = new PreviewController({ render }, { debounceMs: 0, onState: (s) => { if (s.status === "error") errState = s.error; } });
    ctl.request({ A: 1 });
    await vi.advanceTimersByTimeAsync(0); await Promise.resolve();
    expect(errState).toBe("boom");
    vi.useRealTimers();
  });

  it("keeps the previous stl visible while the next render is in flight", async () => {
    vi.useFakeTimers();
    const d2 = deferred<RenderResult>();
    const render = vi.fn()
      .mockResolvedValueOnce(result([1, 2, 3]))
      .mockReturnValueOnce(d2.promise);
    const seen: (Uint8Array | undefined)[] = [];
    const ctl = new PreviewController({ render }, { debounceMs: 0, onState: (s) => seen.push(s.stl) });
    ctl.request({ n: 1 });
    await vi.advanceTimersByTimeAsync(0); await Promise.resolve(); // first done -> stl [1,2,3]
    ctl.request({ n: 2 });
    await vi.advanceTimersByTimeAsync(0); // second render starts (rendering)
    // While rendering, the emitted stl should still be the previous one, not undefined.
    const renderingState = seen[seen.length - 1];
    expect(renderingState).toEqual(new Uint8Array([1, 2, 3]));
    vi.useRealTimers();
  });

  it("does not emit after dispose while a render is in flight", async () => {
    vi.useFakeTimers();
    const d = deferred<RenderResult>();
    const render = vi.fn().mockReturnValue(d.promise);
    const states: string[] = [];
    const ctl = new PreviewController({ render }, { debounceMs: 0, onState: (s) => states.push(s.status) });
    ctl.request({ A: 1 });
    await vi.advanceTimersByTimeAsync(0); // render started -> "rendering"
    ctl.dispose();
    d.resolve(result([1]));
    await Promise.resolve();
    expect(states).toEqual(["rendering"]); // "done" must NOT be emitted after dispose
    vi.useRealTimers();
  });
});

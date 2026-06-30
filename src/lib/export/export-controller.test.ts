import { describe, it, expect, vi } from "vitest";
import { renderParts, zipParts, isEmptyStlError } from "./export-controller";
import { unzipSync } from "fflate";
import type { RenderResult } from "../openscad/types";

const form = {
  Carrier_Type: "omega-d", Film_Format: "35mm", Orientation: "vertical",
  Text_As_Separate_Parts: false,
  Alignment_Board: true, // fused — keeps these controller tests to top + bottom only
};
const ok = (stl: number[]): RenderResult => ({ stl: new Uint8Array(stl), log: "", durationMs: 1 });

describe("renderParts", () => {
  it("renders every part and reports progress", async () => {
    const render = vi.fn().mockResolvedValue(ok([1, 2, 3]));
    const seen: string[] = [];
    const result = await renderParts({ render }, form, (p) => seen.push(`${p.done}/${p.total}`));
    expect(render).toHaveBeenCalledTimes(2); // top + bottom
    expect(result.parts).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(seen).toEqual(["0/2", "1/2", "2/2"]); // before each job + once at end
  });

  it("isEmptyStlError matches both empty messages but not a real failure", () => {
    expect(isEmptyStlError(new Error("Render produced an empty (degenerate) STL."))).toBe(true);
    expect(isEmptyStlError(new Error("produced no output"))).toBe(true);
    expect(isEmptyStlError(new Error("OpenSCAD exited with code 1."))).toBe(false);
  });

  it("skips a part whose render is empty/degenerate (not fatal)", async () => {
    const render = vi.fn()
      .mockResolvedValueOnce(ok([1, 2, 3]))                                   // top OK
      .mockRejectedValueOnce(new Error("Render produced an empty (degenerate) STL.")); // bottom empty
    const result = await renderParts({ render }, form);
    expect(result.parts).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("propagates a non-empty render error (e.g. compile failure)", async () => {
    const render = vi.fn().mockRejectedValue(new Error("OpenSCAD exited with code 1."));
    await expect(renderParts({ render }, form)).rejects.toThrow(/code 1/);
  });
});

describe("zipParts", () => {
  it("bundles parts into a readable zip keyed by name", () => {
    const zip = zipParts([{ name: "a.stl", stl: new Uint8Array([1, 2]) }]);
    const back = unzipSync(zip);
    expect(Array.from(back["a.stl"])).toEqual([1, 2]);
  });
});

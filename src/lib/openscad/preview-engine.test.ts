import { describe, it, expect } from "vitest";
import { selectRenderTarget, supportsBakedPreview } from "./preview-engine";
import type { RenderRequest } from "./types";

const base = (overrides: Partial<RenderRequest> = {}): RenderRequest => ({
  quality: "preview",
  params: { Carrier_Type: "omega-d", Top_or_Bottom: "bottom", Alignment_Board: false },
  ...overrides,
});

describe("selectRenderTarget (baked preview switch)", () => {
  it("uses the baked path for a supported omega-d preview", () => {
    const t = selectRenderTarget(base());
    expect(t.baked).toBe(true);
    expect(t.mainFile).toBe("carrier-baked.scad");
    expect(t.params.Baked_Base_Stl).toBe("/base-stls/omega-d-bottom.stl");
  });

  it("selects the top base STL when Top_or_Bottom=top", () => {
    const t = selectRenderTarget(base({ params: { Carrier_Type: "omega-d", Top_or_Bottom: "top", Alignment_Board: false } }));
    expect(t.params.Baked_Base_Stl).toBe("/base-stls/omega-d-top.stl");
  });

  it("falls back to parametric for final/export renders", () => {
    const t = selectRenderTarget(base({ quality: "final" }));
    expect(t.baked).toBe(false);
    expect(t.mainFile).toBe("carrier.scad");
    expect(t.params.Baked_Base_Stl).toBeUndefined();
  });

  it("supports all baked carriers and their boards", () => {
    for (const carrier of ["omega-d", "lpl-saunders-45xx", "beseler-23c"]) {
      expect(supportsBakedPreview(base({ params: { Carrier_Type: carrier } }))).toBe(true);
    }
  });

  it("selects the right baked base + board STL per carrier/format", () => {
    const lpl = selectRenderTarget(base({ params: { Carrier_Type: "lpl-saunders-45xx", Top_or_Bottom: "top", Alignment_Board: true, Alignment_Board_Type: "lpl-saunders" } }));
    expect(lpl.params.Baked_Base_Stl).toBe("/base-stls/lpl-saunders-45xx-top.stl");
    expect(lpl.params.Baked_Board_Stl).toBe("/base-stls/board-lpl-saunders.stl");

    const omega4x5 = selectRenderTarget(base({ params: { Carrier_Type: "omega-d", Top_or_Bottom: "bottom", Alignment_Board: true, Alignment_Board_Type: "omega", Film_Format: "4x5" } }));
    expect(omega4x5.params.Baked_Board_Stl).toBe("/base-stls/board-omega-4x5.stl");
  });

  it("respects preferBaked=false (force exact parametric for A/B compare)", () => {
    expect(supportsBakedPreview(base({ preferBaked: false }))).toBe(false);
  });

  it("falls back for the test frame (not baked) and unknown carriers", () => {
    expect(supportsBakedPreview(base({ params: { Carrier_Type: "frameAndPegTest" } }))).toBe(false);
    expect(supportsBakedPreview(base({ params: { Carrier_Type: "beseler-45" } }))).toBe(false);
  });

  it("falls back for multi-material part selection", () => {
    expect(supportsBakedPreview(base({ params: { Carrier_Type: "omega-d", _WhichPart: "OwnerText" } }))).toBe(false);
  });

  it("does not mutate the incoming params object", () => {
    const req = base();
    const before = { ...req.params };
    selectRenderTarget(req);
    expect(req.params).toEqual(before);
  });
});

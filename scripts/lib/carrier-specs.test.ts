// Regression guard for a generation-ordering bug: the browser worker fetches
// assets EXCLUSIVELY from public/scad-manifest.json (written by sync:scad), so
// a base STL that exists on disk but is missing from the manifest is never
// mounted and the baked preview fails at render time ("Can't open import
// file"). This happened when beseler-45's STLs were baked AFTER the manifest
// was last synced. Every baked artifact implied by the spec tables must be
// listed in the committed manifest; if this fails, re-run gen:base-stls and
// then sync:scad (in that order).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRIER_SPECS, BOARD_SPECS } from "./carrier-specs";

interface ManifestFile { url: string; path: string; }

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "public/scad-manifest.json"), "utf8"),
) as { files: ManifestFile[] };
const manifestPaths = new Set(manifest.files.map((f) => f.path));

describe("scad-manifest covers every baked artifact in the spec tables", () => {
  const carrierStls = Object.entries(CARRIER_SPECS)
    .filter(([, spec]) => spec.bakesBaseStl)
    .flatMap(([key]) => [`/base-stls/${key}-bottom.stl`, `/base-stls/${key}-top.stl`]);
  const boardStls = Object.values(BOARD_SPECS)
    .filter((spec) => spec.bakeName !== null)
    .map((spec) => `/base-stls/${spec.bakeName}.stl`);

  it.each([...carrierStls, ...boardStls])("%s is listed in public/scad-manifest.json", (stl) => {
    expect(manifestPaths.has(stl)).toBe(true);
  });

  it("spec tables imply a sane number of baked artifacts", () => {
    // 4 baked carriers x 2 parts + 4 boards = 12 (update when adding a carrier/board).
    expect(carrierStls.length + boardStls.length).toBe(12);
  });
});

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets } from "../openscad/render";
import { loadEngine, standardAssets } from "../../../scripts/lib/scad-harness";

// Proves the standalone alignment-board export path: with _Render_Alignment_Board_Only
// set, the carrier renders ONLY the board (of Alignment_Board_Type) as a valid printable
// STL — independent of the carrier and the printed/heat-set peg choice. The bbox
// check matters: the flag once sat in a [Hidden] group, which parameter sets
// skip, so this "board" came out as the ~200mm carrier body.

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

// Board type → expected footprint (mm). Boards are all well under the 200mm+
// carrier bodies, so a carrier-sized result fails loudly.
const BOARDS: [string, { w: number; h: number }][] = [
  ["omega", { w: 127, h: 127 }],
  ["lpl-saunders", { w: 150.75, h: 106.8 }],
  ["beseler-23c", { w: 120, h: 120 }],
];

// Bounding box of a binary STL.
function stlBBox(stl: Uint8Array): { w: number; h: number } {
  const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const n = view.getUint32(80, true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12; // skip normal
    for (let v = 0; v < 3; v++) {
      const x = view.getFloat32(base + v * 12, true), y = view.getFloat32(base + v * 12 + 4, true);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { w: maxX - minX, h: maxY - minY };
}

describe.runIf(hasWasm)("standalone alignment board (integration)", () => {
  // SCAD tree at the FS root (relative includes resolve), BOSL2, and /fonts.
  const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

  it.each(BOARDS)("renders the %s board alone (board-sized, not the carrier)", async (boardType, size) => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({
        noInitialRun: true,
        wasmBinary,
        print: (t: string) => log.push(t),
        printErr: (t: string) => log.push(t),
      });

    const result = await renderScad(
      loadModule,
      fsAssets,
      {
        params: {
          Carrier_Type: "omega-d",
          Film_Format: "35mm",
          Top_or_Bottom: "bottom",
          Render_Quality: "final",
          _Render_Alignment_Board_Only: true,
          Alignment_Board_Type: boardType,
        },
        quality: "final",
      },
      log,
    );

    expect(result.stl.byteLength).toBeGreaterThan(84);
    const view = new DataView(result.stl.buffer, result.stl.byteOffset);
    expect(view.getUint32(80, true)).toBeGreaterThan(0); // triangle count > 0
    const { w, h } = stlBBox(result.stl);
    expect(w).toBeCloseTo(size.w, 0);
    expect(h).toBeCloseTo(size.h, 0);
  }, 180_000);

  it("omega-d-glass exports its screw-on omega board (127mm), not the carrier", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: "omega-d-glass", Film_Format: "4x5", Render_Quality: "final", _Render_Alignment_Board_Only: true }, quality: "final" },
      log,
    );
    const { w, h } = stlBBox(result.stl);
    expect(w).toBeCloseTo(127, 0);
    expect(h).toBeCloseTo(127, 0);
  }, 180_000);
});

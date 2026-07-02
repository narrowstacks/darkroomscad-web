import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets } from "../openscad/render";
import { loadEngine, standardAssets } from "../../../scripts/lib/scad-harness";

// Proves the standalone alignment-board export path: with _Render_Alignment_Board_Only
// set, the carrier renders ONLY the board (of Alignment_Board_Type) as a valid printable
// STL — independent of the carrier and the printed/heat-set peg choice.

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

const BOARD_TYPES = ["omega", "lpl-saunders", "beseler-23c"];

describe.runIf(hasWasm)("standalone alignment board (integration)", () => {
  // SCAD tree at the FS root (relative includes resolve), BOSL2, and /fonts.
  const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

  it.each(BOARD_TYPES)("renders the %s board alone to a non-empty STL", async (boardType) => {
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
  }, 180_000);
});

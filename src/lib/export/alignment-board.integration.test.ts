import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets, type FsFile } from "../openscad/render";

// Proves the standalone alignment-board export path: with _Render_Alignment_Board_Only
// set, the carrier renders ONLY the board (of Alignment_Board_Type) as a valid printable
// STL — independent of the carrier and the printed/heat-set peg choice.

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

function readTree(absDir: string, fsPrefix: string): FsFile[] {
  const out: FsFile[] = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, e.name);
    if (e.isDirectory()) out.push(...readTree(full, `${fsPrefix}/${e.name}`));
    else out.push({ path: `${fsPrefix}/${e.name}`, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}

const BOARD_TYPES = ["omega", "lpl-saunders", "beseler-23c"];

describe.runIf(hasWasm)("standalone alignment board (integration)", () => {
  const wasmBinary = new Uint8Array(readFileSync(WASM_BIN));
  const fsAssets: FsAssets = {
    files: [
      ...readTree(join(process.cwd(), "public/scad"), ""),
      ...readTree(join(process.cwd(), "public/fonts"), "/fonts"),
      ...readTree(join(process.cwd(), "public/libraries"), ""),
    ],
  };

  it.each(BOARD_TYPES)("renders the %s board alone to a non-empty STL", async (boardType) => {
    const mod = await import(WASM_JS);
    const factory = (mod.default ?? mod) as (opts: object) => Promise<unknown>;
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

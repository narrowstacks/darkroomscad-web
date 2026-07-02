import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets } from "./render";
import { DEFAULT_FONT_FAMILY } from "../../config/fonts";
import { loadEngine, standardAssets } from "../../../scripts/lib/scad-harness";

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

describe.runIf(hasWasm)("renderScad (integration)", () => {
  it("renders the default carrier to a non-empty binary STL", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    let activeLog: string[] = [];
    const loadModule = () =>
      factory({
        noInitialRun: true,
        wasmBinary,
        print: (t: string) => activeLog.push(t),
        printErr: (t: string) => activeLog.push(t),
      });

    // SCAD tree at the FS root (relative includes resolve), BOSL2, and /fonts.
    const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

    const log: string[] = [];
    activeLog = log;
    const result = await renderScad(
      loadModule,
      fsAssets,
      {
        params: {
          Carrier_Type: "omega-d",
          Film_Format: "35mm",
          Orientation: "vertical",
          Top_or_Bottom: "bottom",
          Render_Quality: "preview",
          Enable_Owner_Name_Etch: true,
          Owner_Name: "TEST",
          Fontface: DEFAULT_FONT_FAMILY,
        },
        quality: "preview",
      },
      log,
    );

    expect(result.stl.byteLength).toBeGreaterThan(84);
    expect(result.log.length).toBeGreaterThan(0);
    const view = new DataView(result.stl.buffer, result.stl.byteOffset);
    expect(view.getUint32(80, true)).toBeGreaterThan(0); // triangle count > 0
  }, 180_000);

  // Guards the live-preview path: an emscripten module's callMain runs main() once,
  // so each render must get a FRESH instance (the worker creates one per render).
  // This renders twice with fresh instances and asserts both succeed.
  it("renders twice on fresh module instances (multi-render preview path)", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const createModule = (log: string[]) =>
      factory({
        noInitialRun: true,
        wasmBinary,
        print: (t: string) => log.push(t),
        printErr: (t: string) => log.push(t),
      });

    const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

    const render = (alignmentBoard: boolean) => {
      const log: string[] = [];
      return renderScad(
        () => createModule(log),
        fsAssets,
        {
          params: {
            Carrier_Type: "omega-d",
            Film_Format: "35mm",
            Top_or_Bottom: "bottom",
            Render_Quality: "preview",
            Alignment_Board: alignmentBoard,
            Fontface: DEFAULT_FONT_FAMILY,
          },
          quality: "preview",
        },
        log,
      );
    };

    const first = await render(true);
    const second = await render(false); // second render must NOT throw on a reused runtime
    expect(first.stl.byteLength).toBeGreaterThan(84);
    expect(second.stl.byteLength).toBeGreaterThan(84);
  }, 180_000);
});

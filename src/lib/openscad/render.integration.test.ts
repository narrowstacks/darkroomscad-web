import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets, type FsFile } from "./render";
import { DEFAULT_FONT_FAMILY } from "../../config/fonts";

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

// Read a public/ subtree into FsFiles rooted at "/", so /carrier.scad, /src/...,
// /BOSL2/..., /fonts/... all resolve. The SCAD tree is under public/scad, but its
// files must live at the FS ROOT (not under /scad) for the carrier's relative
// includes to resolve — so strip the leading "scad/".
function readTree(absDir: string, fsPrefix: string): FsFile[] {
  const out: FsFile[] = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, e.name);
    if (e.isDirectory()) out.push(...readTree(full, `${fsPrefix}/${e.name}`));
    else out.push({ path: `${fsPrefix}/${e.name}`, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}

describe.runIf(hasWasm)("renderScad (integration)", () => {
  it("renders the default carrier to a non-empty binary STL", async () => {
    const wasmBinary = new Uint8Array(readFileSync(WASM_BIN));
    const mod = await import(WASM_JS);
    const factory = (mod.default ?? mod) as (opts: object) => Promise<any>;
    const log: string[] = [];
    const loadModule = () =>
      factory({
        noInitialRun: true,
        wasmBinary,
        print: (t: string) => log.push(t),
        printErr: (t: string) => log.push(t),
      });

    const scadFiles = readTree(join(process.cwd(), "public/scad"), ""); // strips to FS root
    const fontFiles = readTree(join(process.cwd(), "public/fonts"), "/fonts");
    const libFiles = readTree(join(process.cwd(), "public/libraries"), ""); // -> /BOSL2/...

    const fsAssets: FsAssets = { files: [...scadFiles, ...fontFiles, ...libFiles] };

    const result = await renderScad(loadModule, fsAssets, {
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
    });

    expect(result.stl.byteLength).toBeGreaterThan(84);
    const view = new DataView(result.stl.buffer, result.stl.byteOffset);
    expect(view.getUint32(80, true)).toBeGreaterThan(0); // triangle count > 0
  }, 180_000);
});

// PROTOTYPE verification: the baked-base preview path (carrier-baked.scad importing
// a pre-baked base STL with native cuts) renders to a valid carrier, much faster than
// the full parametric path, and is dimensionally equivalent to it.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const BASE_STL = join(process.cwd(), "public/base-stls/omega-d-bottom.stl");
const hasAll = existsSync(WASM_JS) && existsSync(WASM_BIN) && existsSync(BASE_STL);

type FsFile = { path: string; data: Uint8Array };
function readTree(absDir: string, fsPrefix: string): FsFile[] {
  const out: FsFile[] = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, e.name);
    if (e.isDirectory()) out.push(...readTree(full, `${fsPrefix}/${e.name}`));
    else out.push({ path: `${fsPrefix}/${e.name}`, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}
function mkdirP(FS: any, dir: string) {
  const parts = dir.split("/").filter(Boolean); let cur = "";
  for (const p of parts) { cur += "/" + p; if (!FS.analyzePath(cur).exists) FS.mkdir(cur); }
}

// Axis-aligned bounding box of a binary STL (for dimensional equivalence checks).
function stlBBox(stl: Uint8Array) {
  const dv = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const n = dv.getUint32(80, true);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let o = 84;
  for (let t = 0; t < n; t++) {
    o += 12; // skip normal
    for (let v = 0; v < 3; v++) {
      for (let a = 0; a < 3; a++) {
        const c = dv.getFloat32(o, true); o += 4;
        if (c < lo[a]) lo[a] = c;
        if (c > hi[a]) hi[a] = c;
      }
    }
    o += 2; // attribute byte count
  }
  return { size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], tris: n };
}

describe.runIf(hasAll)("baked-base preview path (prototype)", () => {
  const wasmBinary = new Uint8Array(readFileSync(WASM_BIN));
  const assets: FsFile[] = [
    ...readTree(join(process.cwd(), "public/scad"), ""),
    ...readTree(join(process.cwd(), "public/fonts"), "/fonts"),
    ...readTree(join(process.cwd(), "public/libraries"), ""),
    ...readTree(join(process.cwd(), "public/base-stls"), "/base-stls"),
  ];

  async function render(mainFile: string, params: string[]): Promise<{ stl: Uint8Array; ms: number }> {
    const mod = await import(WASM_JS);
    const factory = (mod.default ?? mod) as (o: object) => Promise<any>;
    const log: string[] = [];
    const inst = await factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    for (const f of assets) { const d = f.path.slice(0, f.path.lastIndexOf("/")); if (d) mkdirP(inst.FS, d); inst.FS.writeFile(f.path, f.data); }
    const args = ["/" + mainFile, "-o", "/out.stl", "--backend=manifold", "--enable=all", "--export-format=binstl", ...params];
    const t0 = performance.now();
    const code = inst.callMain(args);
    const ms = performance.now() - t0;
    if (code !== 0) throw new Error(`${mainFile} exit ${code}\n${log.slice(-8).join("\n")}`);
    return { stl: inst.FS.readFile("/out.stl"), ms };
  }

  // Common feature params (carrier-agnostic): 35mm bottom, no flip, owner+type text.
  const P = [
    '-D', 'Film_Format="35mm"', '-D', 'Orientation="vertical"', '-D', 'Top_or_Bottom="bottom"',
    '-D', 'Flip_Bottom_For_Printing=false', '-D', 'Printed_or_Heat_Set_Pegs="heat_set"',
    '-D', 'Enable_Owner_Name_Etch=true', '-D', 'Owner_Name="AARON"',
    '-D', 'Enable_Type_Name_Etch=true', '-D', 'Fontface="Liberation Mono"',
  ];

  // Every baked carrier + its default board. Each renders both paths and asserts the
  // outer bounding box matches the exact parametric assembly within tolerance.
  const CARRIERS = [
    { carrier: "omega-d", board: "omega", baseStl: "omega-d-bottom", boardStl: "board-omega" },
    { carrier: "lpl-saunders-45xx", board: "lpl-saunders", baseStl: "lpl-saunders-45xx-bottom", boardStl: "board-lpl-saunders" },
    { carrier: "beseler-23c", board: "beseler-23c", baseStl: "beseler-23c-bottom", boardStl: "board-beseler-23c" },
  ];

  for (const c of CARRIERS) {
    it(`${c.carrier}: baked (base + board) matches parametric dims and is faster`, async () => {
      const withBoard = [...P, '-D', 'Alignment_Board=true', '-D', `Alignment_Board_Type="${c.board}"`];
      const baked = await render("carrier-baked.scad", [
        '-D', `Carrier_Type="${c.carrier}"`,
        '-D', `Baked_Base_Stl="/base-stls/${c.baseStl}.stl"`,
        '-D', `Baked_Board_Stl="/base-stls/${c.boardStl}.stl"`, ...withBoard,
      ]);
      const param = await render("carrier.scad", ['-D', `Carrier_Type="${c.carrier}"`, '-D', 'Render_Quality="final"', ...withBoard]);

      const b = stlBBox(baked.stl), p = stlBBox(param.stl);
      expect(baked.stl.byteLength).toBeGreaterThan(84);
      expect(b.tris).toBeGreaterThan(100);
      // Outer footprint matches the parametric assembly within tolerance on every axis.
      for (let a = 0; a < 3; a++) expect(Math.abs(b.size[a] - p.size[a])).toBeLessThan(0.6);
      expect(baked.ms).toBeLessThan(param.ms);
      // eslint-disable-next-line no-console
      console.log(`[${c.carrier}] baked=${baked.ms.toFixed(0)}ms (${b.tris} tris)  parametric=${param.ms.toFixed(0)}ms (${p.tris} tris)  speedup=${(param.ms / baked.ms).toFixed(1)}x  bbox=[${b.size.map((s) => s.toFixed(1)).join(",")}]`);
    }, 180_000);
  }
});

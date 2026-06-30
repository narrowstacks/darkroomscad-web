// PROTOTYPE: bake the parameter-independent carrier base bodies to STL so the
// live-preview path (carrier-baked.scad) can import() them instead of re-running
// BOSL2's expensive geometry on every render. Mirrors the gen-carrier-outlines.ts
// pattern: mount the SCAD tree + BOSL2 into the WASM FS, render a tiny wrapper that
// calls the base-shape module, export binary STL.
//
// The base body is format/orientation/peg/text independent, so one STL per
// (carrier, top|bottom) covers every film format. Run: npm run gen:base-stls
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface EmscriptenFS {
  writeFile(path: string, data: Uint8Array | string): void;
  readFile(path: string): Uint8Array;
  mkdir(path: string): void;
  analyzePath(path: string): { exists: boolean };
}
interface OpenScadInstance { FS: EmscriptenFS; callMain(args: string[]): number; }
type OpenScadFactory = (opts: {
  noInitialRun?: boolean; wasmBinary: Uint8Array;
  print?: (s: string) => void; printErr?: (s: string) => void;
}) => Promise<OpenScadInstance>;

// Each baked variant: a wrapper that includes BOSL2 (the entry point supplies it,
// since the base-shape file no longer self-includes it) + the base shape, and calls
// the module. config arg is unused by the module; top_or_bottom drives separation hole.
const VARIANTS = [
  // Carrier base bodies (format-independent; one per top/bottom). The test frame is
  // intentionally excluded — its base geometry depends on film format, and it already
  // renders fast parametrically.
  { name: "omega-d-bottom",          include: "src/omega-d-base-shape.scad",       call: 'omega_d_base_shape(0, "bottom");' },
  { name: "omega-d-top",             include: "src/omega-d-base-shape.scad",       call: 'omega_d_base_shape(0, "top");' },
  { name: "lpl-saunders-45xx-bottom", include: "src/lpl-saunders-base-shape.scad", call: 'lpl_saunders_base_shape(0, "bottom");' },
  { name: "lpl-saunders-45xx-top",    include: "src/lpl-saunders-base-shape.scad", call: 'lpl_saunders_base_shape(0, "top");' },
  { name: "beseler-23c-bottom",       include: "src/beseler-23c-base-shape.scad",  call: 'beseler_23c_base_shape(0, "bottom");' },
  { name: "beseler-23c-top",          include: "src/beseler-23c-base-shape.scad",  call: 'beseler_23c_base_shape(0, "top");' },
  // Alignment boards (fused onto the carrier at a carrier/board-specific Z). The omega
  // board's opening differs for 4x5, so it has two variants; lpl/beseler boards are
  // format-independent (one each).
  { name: "board-omega",       include: "src/common/omega-d-alignment-board.scad",     call: 'omega_d_alignment_board_no_screws("35mm");' },
  { name: "board-omega-4x5",   include: "src/common/omega-d-alignment-board.scad",     call: 'omega_d_alignment_board_no_screws("4x5");' },
  { name: "board-lpl-saunders", include: "src/common/lpl-saunders-alignment-board.scad", call: 'lpl_saunders_alignment_board();' },
  { name: "board-beseler-23c",  include: "src/common/beseler-23c-alignment-board.scad",  call: 'beseler_23c_alignment_board();' },
];

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
function mkdirP(FS: EmscriptenFS, dir: string) {
  const parts = dir.split("/").filter(Boolean); let cur = "";
  for (const p of parts) { cur += "/" + p; if (!FS.analyzePath(cur).exists) FS.mkdir(cur); }
}

async function main() {
  const cwd = process.cwd();
  const outDir = join(cwd, "public/base-stls");
  mkdirSync(outDir, { recursive: true });

  const wasmBinary = new Uint8Array(readFileSync(join(cwd, "public/wasm/openscad.wasm")));
  const mod = await import(join(cwd, "public/wasm/openscad.js"));
  const factory = (mod.default ?? mod) as OpenScadFactory;

  const assets = [
    ...readTree(join(cwd, "public/scad"), ""),      // -> FS root, relative includes resolve
    ...readTree(join(cwd, "public/libraries"), ""), // -> /BOSL2/...
  ];

  for (const v of VARIANTS) {
    const log: string[] = [];
    const inst = await factory({
      noInitialRun: true, wasmBinary,
      print: (t) => log.push(t), printErr: (t) => log.push(t),
    });
    for (const f of assets) {
      const dir = f.path.slice(0, f.path.lastIndexOf("/"));
      if (dir) mkdirP(inst.FS, dir);
      inst.FS.writeFile(f.path, f.data);
    }
    // Bake at high quality once (frozen tessellation is fine for an imported base).
    inst.FS.writeFile("/bake.scad",
      `include <BOSL2/std.scad>\ninclude <BOSL2/rounding.scad>\ninclude <${v.include}>\n$fn=100;\n${v.call}\n`);
    const code = inst.callMain(["/bake.scad", "-o", "/base.stl", "--backend=manifold", "--enable=all", "--export-format=binstl"]);
    if (code !== 0) throw new Error(`bake ${v.name}: OpenSCAD exit ${code}\n${log.slice(-8).join("\n")}`);
    const stl = inst.FS.readFile("/base.stl");
    if (stl.byteLength <= 84) throw new Error(`bake ${v.name}: empty STL`);
    writeFileSync(join(outDir, `${v.name}.stl`), stl);
    const tris = new DataView(stl.buffer, stl.byteOffset).getUint32(80, true);
    console.log(`baked public/base-stls/${v.name}.stl  (${stl.byteLength} B, ${tris} triangles)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

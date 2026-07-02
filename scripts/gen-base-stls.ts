// PROTOTYPE: bake the parameter-independent carrier base bodies to STL so the
// live-preview path (carrier-baked.scad) can import() them instead of re-running
// BOSL2's expensive geometry on every render. Mirrors the gen-carrier-outlines.ts
// pattern: mount the SCAD tree + BOSL2 into the WASM FS, render a tiny wrapper that
// calls the base-shape module, export binary STL.
//
// The base body is format/orientation/peg/text independent, so one STL per
// (carrier, top|bottom) covers every film format. Run: npm run gen:base-stls
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadEngine, mountFiles, standardAssets } from "./lib/scad-harness";
import { CARRIER_SPECS, BOARD_SPECS } from "./lib/carrier-specs";

// Bake-path adapter: the committed base STLs were originally baked from call
// strings with arg0 `0` (vs the outlines' `[]`) and the omega board with "35mm"
// (vs the outlines' ""). Both args are semantically inert here (the config arg is
// unused; the board arg only matters via `== "4x5"`), but Manifold's output byte
// layout is sensitive to the source text, so the bake path keeps the historical
// forms to leave public/base-stls byte-identical across regenerations.
const bakeCall = (call: string) =>
  call
    .replace("([], ", "(0, ")
    .replace('omega_d_alignment_board_no_screws("")', 'omega_d_alignment_board_no_screws("35mm")');

// Each baked variant: a wrapper that includes BOSL2 (the entry point supplies it,
// since the base-shape file no longer self-includes it) + the base shape, and calls
// the module. Derived from the shared spec table:
// - Carrier base bodies (format-independent; one per top/bottom) for every carrier
//   with bakesBaseStl (the test frame is excluded — its base geometry depends on
//   film format, and it already renders fast parametrically).
// - Alignment boards (fused onto the carrier at a carrier/board-specific Z) for
//   every board with a bakeName. The omega board's opening differs for 4x5, so it
//   has two variants; lpl/beseler boards are format-independent (one each).
const VARIANT_LIST: { name: string; include: string; call: string }[] = [
  ...Object.entries(CARRIER_SPECS)
    .filter(([, spec]) => spec.bakesBaseStl)
    .flatMap(([key, spec]) =>
      (["bottom", "top"] as const).map((part) => ({
        name: `${key}-${part}`,
        // beseler-45 bakes extra geometry (corner pegs) that lives in the
        // universal assembly, so it overrides the outline's include/call.
        include: spec.bakeInclude ?? spec.include,
        call: bakeCall((spec.bakeCallOverride ?? spec.call)(part)),
      })),
    ),
  ...Object.values(BOARD_SPECS)
    .filter((spec) => spec.bakeName !== null)
    .map((spec) => ({ name: spec.bakeName as string, include: spec.include, call: bakeCall(spec.call) })),
];

async function main() {
  const cwd = process.cwd();
  const outDir = join(cwd, "public/base-stls");
  mkdirSync(outDir, { recursive: true });

  const { factory, wasmBinary } = await loadEngine(cwd);
  const assets = standardAssets(cwd);

  for (const v of VARIANT_LIST) {
    const log: string[] = [];
    const inst = await factory({
      noInitialRun: true, wasmBinary,
      print: (t) => log.push(t), printErr: (t) => log.push(t),
    });
    mountFiles(inst.FS, assets);
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

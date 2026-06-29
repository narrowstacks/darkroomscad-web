// Generate carrier body-outline SVGs from the real OpenSCAD geometry.
//
// For each carrier type we render ONLY the base-shape module (no film opening,
// no text, no pegs, no alignment board) through projection() to a 2D SVG using
// the vendored WASM engine, keep the outer contour, and write a committed
// public/outlines/<value>.svg. Run once: `npm run gen:outlines`.
//
// render.ts hardcodes --export-format=binstl, so we drive the engine factory
// directly here (same FS-mount pattern as render.integration.test.ts) with SVG
// export args.
//
// IMPORTANT — Manifold robustness: this vendored Manifold WASM build is flaky on
// the carriers' rounded-cuboid/handle unions under projection(). At some $fn
// values it silently DROPS a unioned feature (e.g. the LPL handle), producing a
// smaller-than-real silhouette. So per carrier we sweep candidate $fn values and
// accept ONLY a projection whose bounding box meets the carrier's known-correct
// minimum dimensions (validated once against the 3D geometry). If no candidate
// qualifies we throw — the generator never emits a silent partial outline.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { extractOuterContour } from "../src/lib/outline/outer-contour";

interface FsFile { path: string; data: Uint8Array }

interface CarrierSpec {
  include: string;       // base-shape file to include (relative to FS root)
  call: string;          // module invocation producing the carrier BODY only
  minWidth: number;      // required projected bbox width (catches dropped features)
  minHeight: number;     // required projected bbox height
}

// beseler-45 has no dedicated base shape and is not implemented in carrier.scad,
// so its silhouette reuses the beseler-23c circular-with-handle geometry.
const CARRIERS: Record<string, CarrierSpec> = {
  "omega-d": {
    include: "src/omega-d-base-shape.scad",
    call: 'omega_d_base_shape([], "bottom");',
    minWidth: 200, minHeight: 165,            // body ~202 long, ~168 tall
  },
  "lpl-saunders-45xx": {
    include: "src/lpl-saunders-base-shape.scad",
    call: 'lpl_saunders_base_shape([], "bottom");',
    minWidth: 220, minHeight: 175,            // ~178 clipped circle + handle (~228 wide)
  },
  "beseler-23c": {
    include: "src/beseler-23c-base-shape.scad",
    call: 'beseler_23c_base_shape([], "bottom");',
    minWidth: 190, minHeight: 155,            // 160 circle + handle (~197 wide)
  },
  "beseler-45": {
    include: "src/beseler-23c-base-shape.scad",
    call: 'beseler_23c_base_shape([], "bottom");',
    minWidth: 190, minHeight: 155,
  },
  frameAndPegTest: {
    include: "src/test-frame-base-shape.scad",
    call: 'test_frame_base_shape([2,5.6,4], "bottom", 36, 24, 25, 35);',
    minWidth: 70, minHeight: 90,              // simple rounded rectangle
  },
};

// $fn candidates, ordered by empirically observed reliability for these unions.
const FN_CANDIDATES = [72, 90, 96, 80, 60, 48, 100];

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
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
  }
}

function vbDims(viewBox: string): { w: number; h: number } {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return { w, h };
}

async function main() {
  const cwd = process.cwd();
  const outDir = join(cwd, "public/outlines");
  mkdirSync(outDir, { recursive: true });

  const wasmBinary = new Uint8Array(readFileSync(join(cwd, "public/wasm/openscad.wasm")));
  const mod = await import(join(cwd, "public/wasm/openscad.js"));
  const factory = (mod.default ?? mod) as (opts: object) => Promise<any>;

  const assets = [
    ...readTree(join(cwd, "public/scad"), ""),       // -> FS root (so relative includes resolve)
    ...readTree(join(cwd, "public/libraries"), ""),  // -> /BOSL2/...
  ];

  async function project(spec: CarrierSpec, fn: number): Promise<{ d: string; viewBox: string }> {
    const log: string[] = [];
    const inst = await factory({
      noInitialRun: true, wasmBinary,
      print: (t: string) => log.push(t), printErr: (t: string) => log.push(t),
    });
    for (const f of assets) {
      const dir = f.path.slice(0, f.path.lastIndexOf("/"));
      if (dir) mkdirP(inst.FS, dir);
      inst.FS.writeFile(f.path, f.data);
    }
    inst.FS.writeFile("/outline.scad",
      `include <${spec.include}>\n$fn=${fn};\nprojection(cut=false) ${spec.call}\n`);
    const code = inst.callMain(["/outline.scad", "-o", "/o.svg", "--export-format=svg", "--enable=all"]);
    if (code) throw new Error(`OpenSCAD exited ${code}\n${log.join("\n")}`);
    const rawSvg = new TextDecoder().decode(inst.FS.readFile("/o.svg"));
    return extractOuterContour(rawSvg);
  }

  for (const [carrier, spec] of Object.entries(CARRIERS)) {
    let chosen: { d: string; viewBox: string; fn: number } | undefined;
    for (const fn of FN_CANDIDATES) {
      const { d, viewBox } = await project(spec, fn);
      const { w, h } = vbDims(viewBox);
      if (w >= spec.minWidth && h >= spec.minHeight) { chosen = { d, viewBox, fn }; break; }
    }
    if (!chosen) {
      throw new Error(
        `${carrier}: no $fn in [${FN_CANDIDATES}] produced a projection meeting ` +
        `min dims ${spec.minWidth}x${spec.minHeight} — Manifold likely dropped a feature.`,
      );
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${chosen.viewBox}"><path d="${chosen.d}" fill="currentColor"/></svg>\n`;
    writeFileSync(join(outDir, `${carrier}.svg`), svg);
    console.log(`wrote public/outlines/${carrier}.svg  ($fn=${chosen.fn}, viewBox=${chosen.viewBox})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

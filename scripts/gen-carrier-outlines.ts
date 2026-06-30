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
import { extractOuterContour, extractAllContours } from "../src/lib/outline/outer-contour";

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

// Alignment boards: keep ALL contours so the board opening renders (evenodd).
// Omega's opening widens for 4x5, so it gets two variants; the outer outline is
// identical between them.
const BOARDS: Record<string, CarrierSpec> = {
  "omega": {
    include: "src/common/omega-d-alignment-board.scad",
    call: 'omega_d_alignment_board_no_screws("");',
    minWidth: 120, minHeight: 120,
  },
  "omega-4x5": {
    include: "src/common/omega-d-alignment-board.scad",
    call: 'omega_d_alignment_board_no_screws("4x5");',
    minWidth: 120, minHeight: 120,
  },
  "lpl-saunders": {
    include: "src/common/lpl-saunders-alignment-board.scad",
    call: 'lpl_saunders_alignment_board();',
    minWidth: 150, minHeight: 100,
  },
  "beseler-23c": {
    include: "src/common/beseler-23c-alignment-board.scad",
    call: 'beseler_23c_alignment_board();',
    minWidth: 110, minHeight: 110,
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

  async function project(
    spec: CarrierSpec,
    fn: number,
    extract: (svg: string) => { d: string; viewBox: string } = extractOuterContour,
  ): Promise<{ d: string; viewBox: string }> {
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
    return extract(rawSvg);
  }

  // Generate bottom and top variants for each carrier. Top is the same body minus
  // a small corner separation_hole, so bbox/min-dim thresholds are identical.
  const inline: Record<string, { viewBox: string; d: string }> = {};
  for (const [carrier, spec] of Object.entries(CARRIERS)) {
    for (const part of ["bottom", "top"] as const) {
      const topCall = spec.call.replace('"bottom"', '"top"');
      const partSpec = part === "top" ? { ...spec, call: topCall } : spec;
      const key = part === "top" ? `${carrier}:top` : carrier;
      const svgFile = part === "top" ? `${carrier}-top.svg` : `${carrier}.svg`;

      let chosen: { d: string; viewBox: string; fn: number } | undefined;
      for (const fn of FN_CANDIDATES) {
        const { d, viewBox } = await project(partSpec, fn);
        const { w, h } = vbDims(viewBox);
        if (w >= spec.minWidth && h >= spec.minHeight) { chosen = { d, viewBox, fn }; break; }
      }
      if (!chosen) {
        throw new Error(
          `${carrier} (${part}): no $fn in [${FN_CANDIDATES}] produced a projection meeting ` +
          `min dims ${spec.minWidth}x${spec.minHeight} — Manifold likely dropped a feature.`,
        );
      }
      const d = chosen.d.replace(/\s+/g, " ").trim();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${chosen.viewBox}"><path d="${d}" fill="currentColor"/></svg>\n`;
      writeFileSync(join(outDir, svgFile), svg);
      inline[key] = { viewBox: chosen.viewBox, d };
      console.log(`wrote public/outlines/${svgFile}  ($fn=${chosen.fn}, viewBox=${chosen.viewBox})`);
    }
  }

  // Emit the inline map the UI consumes (rendered with fill="currentColor" so the
  // silhouette follows the theme text color). Keeps src/lib/outline/outlines.ts in sync.
  // Written BEFORE the board loop so a board failure cannot prevent carriers from updating.
  const tsLines = [
    "// Carrier value -> inline outline geometry (viewBox + SVG path).",
    "// GENERATED by scripts/gen-carrier-outlines.ts (also writes public/outlines/*.svg).",
    "// Rendered inline with fill=\"currentColor\" so the silhouette follows the theme text color.",
    "// Keys: \"<carrier>\" (bottom) and \"<carrier>:top\" (top — has the corner separation-hole notch).",
    "export interface CarrierOutline { viewBox: string; d: string; }",
    "",
    "export const CARRIER_OUTLINES: Record<string, CarrierOutline> = {",
    ...Object.entries(inline).map(([k, v]) =>
      `  ${JSON.stringify(k)}: { viewBox: ${JSON.stringify(v.viewBox)}, d: ${JSON.stringify(v.d)} },`),
    "};",
    "",
  ];
  writeFileSync(join(cwd, "src/lib/outline/outlines.ts"), tsLines.join("\n"));
  console.log("wrote src/lib/outline/outlines.ts (inline map)");

  // ---- Alignment board outlines (all contours kept) ----
  // Per-board errors are caught and logged; on any failure we leave board-outlines.ts
  // and the failed board's SVG untouched (the beseler-23c torus projection is intermittent).
  const boardInline: Record<string, { viewBox: string; d: string }> = {};
  let boardFailed = false;
  for (const [key, spec] of Object.entries(BOARDS)) {
    try {
      let chosen: { d: string; viewBox: string; fn: number } | undefined;
      for (const fn of FN_CANDIDATES) {
        const { d, viewBox } = await project(spec, fn, extractAllContours);
        const { w, h } = vbDims(viewBox);
        if (w >= spec.minWidth && h >= spec.minHeight) { chosen = { d, viewBox, fn }; break; }
      }
      if (!chosen) {
        throw new Error(
          `board ${key}: no $fn in [${FN_CANDIDATES}] met min dims ` +
          `${spec.minWidth}x${spec.minHeight} — Manifold likely dropped a feature.`,
        );
      }
      const d = chosen.d.replace(/\s+/g, " ").trim();
      writeFileSync(join(outDir, `board-${key}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${chosen.viewBox}"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>\n`);
      boardInline[key] = { viewBox: chosen.viewBox, d };
      console.log(`wrote public/outlines/board-${key}.svg  ($fn=${chosen.fn}, viewBox=${chosen.viewBox})`);
    } catch (e) {
      console.error(`board ${key} FAILED — leaving existing SVG and board-outlines.ts untouched:`, e);
      boardFailed = true;
    }
  }

  if (boardFailed) {
    console.warn("board-outlines.ts NOT rewritten (one or more board projections failed).");
  } else {
    const boardTsLines = [
      "// Alignment-board value -> inline outline geometry (outer outline + opening).",
      "// GENERATED by scripts/gen-carrier-outlines.ts. Render with fill-rule=\"evenodd\".",
      "export interface BoardOutline { viewBox: string; d: string; }",
      "",
      "export const BOARD_OUTLINES: Record<string, BoardOutline> = {",
      ...Object.entries(boardInline).map(([k, v]) =>
        `  ${JSON.stringify(k)}: { viewBox: ${JSON.stringify(v.viewBox)}, d: ${JSON.stringify(v.d)} },`),
      "};",
      "",
    ];
    writeFileSync(join(cwd, "src/lib/outline/board-outlines.ts"), boardTsLines.join("\n"));
    console.log("wrote src/lib/outline/board-outlines.ts (inline map)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

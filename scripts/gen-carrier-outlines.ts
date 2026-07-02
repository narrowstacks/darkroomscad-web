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

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { extractOuterContour, extractAllContours } from "../src/lib/outline/outer-contour";
import { loadEngine, mountFiles, standardAssets } from "./lib/scad-harness";
import { CARRIER_SPECS, BOARD_SPECS } from "./lib/carrier-specs";

// One projection job: an include + module invocation plus the required projected
// bbox minimums (catches Manifold silently dropping a unioned feature).
interface OutlineJob {
  include: string; // base-shape file to include (relative to FS root)
  call: string; // module invocation producing the carrier BODY only
  minWidth: number; // required projected bbox width
  minHeight: number; // required projected bbox height
}

// $fn candidates, ordered by empirically observed reliability for these unions.
const FN_CANDIDATES = [72, 90, 96, 80, 60, 48, 100];

function vbDims(viewBox: string): { w: number; h: number } {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return { w, h };
}

async function main() {
  const cwd = process.cwd();
  const outDir = join(cwd, "public/outlines");
  mkdirSync(outDir, { recursive: true });

  const { factory, wasmBinary } = await loadEngine(cwd);
  const assets = standardAssets(cwd);

  async function project(
    job: OutlineJob,
    fn: number,
    extract: (svg: string) => { d: string; viewBox: string } = extractOuterContour,
  ): Promise<{ d: string; viewBox: string }> {
    const log: string[] = [];
    const inst = await factory({
      noInitialRun: true, wasmBinary,
      print: (t: string) => log.push(t), printErr: (t: string) => log.push(t),
    });
    mountFiles(inst.FS, assets);
    // BOSL2 is included here at the wrapper (entry-point) level. The base-shape
    // and alignment-board files under src/ no longer include BOSL2 themselves
    // (it lives once in carrier.scad for the render path) to avoid re-parsing the
    // ~80k-line library many times per render. This wrapper is their entry point,
    // so it must supply BOSL2 (std + rounding) before including the job file.
    inst.FS.writeFile("/outline.scad",
      `include <BOSL2/std.scad>\ninclude <BOSL2/rounding.scad>\ninclude <${job.include}>\n$fn=${fn};\nprojection(cut=false) ${job.call}\n`);
    const code = inst.callMain(["/outline.scad", "-o", "/o.svg", "--export-format=svg", "--enable=all"]);
    if (code) throw new Error(`OpenSCAD exited ${code}\n${log.join("\n")}`);
    const rawSvg = new TextDecoder().decode(inst.FS.readFile("/o.svg"));
    return extract(rawSvg);
  }

  // Generate bottom and top variants for each carrier. Top is the same body minus
  // a small corner separation_hole, so bbox/min-dim thresholds are identical.
  const inline: Record<string, { viewBox: string; d: string }> = {};
  for (const [carrier, spec] of Object.entries(CARRIER_SPECS)) {
    if (!spec.outline) continue;
    for (const part of ["bottom", "top"] as const) {
      const job: OutlineJob = { include: spec.include, call: spec.call(part), ...spec.outline };
      const key = part === "top" ? `${carrier}:top` : carrier;
      const svgFile = part === "top" ? `${carrier}-top.svg` : `${carrier}.svg`;

      let chosen: { d: string; viewBox: string; fn: number } | undefined;
      for (const fn of FN_CANDIDATES) {
        const { d, viewBox } = await project(job, fn);
        const { w, h } = vbDims(viewBox);
        if (w >= job.minWidth && h >= job.minHeight) { chosen = { d, viewBox, fn }; break; }
      }
      if (!chosen) {
        throw new Error(
          `${carrier} (${part}): no $fn in [${FN_CANDIDATES}] produced a projection meeting ` +
          `min dims ${job.minWidth}x${job.minHeight} — Manifold likely dropped a feature.`,
        );
      }
      const d = chosen.d.replace(/\s+/g, " ").trim();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${chosen.viewBox}"><path d="${d}" fill="currentColor"/></svg>\n`;
      writeFileSync(join(outDir, svgFile), svg);
      inline[key] = { viewBox: chosen.viewBox, d };
      console.log(`wrote public/outlines/${svgFile}  ($fn=${chosen.fn}, viewBox=${chosen.viewBox})`);
    }
  }

  // Write the carrier outline DATA to generated/carrier-outlines.json; the typed
  // loader src/lib/outline/outlines.ts imports it. Written BEFORE the board loop so
  // a board failure cannot prevent carriers from updating.
  mkdirSync(join(cwd, "generated"), { recursive: true });
  writeFileSync(
    join(cwd, "generated/carrier-outlines.json"),
    JSON.stringify(inline, null, 2) + "\n",
  );
  console.log("wrote generated/carrier-outlines.json");

  // ---- Alignment board outlines (all contours kept, evenodd) ----
  // Per-board errors are caught and logged; on any failure we leave
  // generated/board-outlines.json and the failed board's SVG untouched (the
  // beseler-23c torus projection is intermittent).
  const boardInline: Record<string, { viewBox: string; d: string }> = {};
  let boardFailed = false;
  for (const [key, spec] of Object.entries(BOARD_SPECS)) {
    if (!spec.outline) continue;
    const job: OutlineJob = { include: spec.include, call: spec.call, ...spec.outline };
    try {
      let chosen: { d: string; viewBox: string; fn: number } | undefined;
      for (const fn of FN_CANDIDATES) {
        const { d, viewBox } = await project(job, fn, extractAllContours);
        const { w, h } = vbDims(viewBox);
        if (w >= job.minWidth && h >= job.minHeight) { chosen = { d, viewBox, fn }; break; }
      }
      if (!chosen) {
        throw new Error(
          `board ${key}: no $fn in [${FN_CANDIDATES}] met min dims ` +
          `${job.minWidth}x${job.minHeight} — Manifold likely dropped a feature.`,
        );
      }
      const d = chosen.d.replace(/\s+/g, " ").trim();
      writeFileSync(join(outDir, `board-${key}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${chosen.viewBox}"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>\n`);
      boardInline[key] = { viewBox: chosen.viewBox, d };
      console.log(`wrote public/outlines/board-${key}.svg  ($fn=${chosen.fn}, viewBox=${chosen.viewBox})`);
    } catch (e) {
      console.error(`board ${key} FAILED — leaving existing SVG and generated/board-outlines.json untouched:`, e);
      boardFailed = true;
    }
  }

  if (boardFailed) {
    console.warn("generated/board-outlines.json NOT rewritten (one or more board projections failed).");
  } else {
    writeFileSync(
      join(cwd, "generated/board-outlines.json"),
      JSON.stringify(boardInline, null, 2) + "\n",
    );
    console.log("wrote generated/board-outlines.json");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

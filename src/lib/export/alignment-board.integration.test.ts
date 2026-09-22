import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets } from "../openscad/render";
import { loadEngine, standardAssets } from "../../../scripts/lib/scad-harness";

// Proves the standalone alignment-board export path: with _Render_Alignment_Board_Only
// set, the carrier renders ONLY the board (of Alignment_Board_Type) as a valid printable
// STL — independent of the carrier and the printed/heat-set peg choice. The bbox
// check matters: the flag once sat in a [Hidden] group, which parameter sets
// skip, so this "board" came out as the ~200mm carrier body.

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

// Board type → expected footprint (mm), and where the standalone board's
// pilot holes for the carrier's footprint screws are (the carrier's
// BOARD_SCREW_PATTERNS; none for the omega board). Boards are all well under
// the 200mm+ carrier bodies, so a carrier-sized result fails loudly.
const D23 = (57.5 * Math.SQRT2) / 2;
const BOARDS: [string, { w: number; h: number; pilots: [number, number][] }][] = [
  ["omega", { w: 127, h: 127, pilots: [[41, 56.5], [-41, 56.5], [41, -56.5], [-41, -56.5]] }],
  ["lpl-saunders", { w: 150.75, h: 106.8, pilots: [[68, 35], [-68, 35], [68, -35], [-68, -35]] }],
  ["beseler-23c", { w: 120, h: 120, pilots: [[D23, D23], [-D23, D23], [D23, -D23], [-D23, -D23]] }],
];
// Pilot hole: the heat-set thread-forming size (same screws as the pegs);
// default M2: 1.6 tap drill + 0.3 FDM compensation.
const PILOT_R = 1.9 / 2;

// Does the STL have a cylindrical wall of radius r around (cx, cy)? Counts
// vertices sitting on that radius (the $fn=24 hole polygon puts many there).
function wallVertsAt(stl: Uint8Array, cx: number, cy: number, r: number, tol = 0.1): number {
  const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const n = view.getUint32(80, true);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const x = view.getFloat32(base + v * 12, true), y = view.getFloat32(base + v * 12 + 4, true);
      if (Math.abs(Math.hypot(x - cx, y - cy) - r) < tol) hits++;
    }
  }
  return hits;
}

// Bounding box of a binary STL.
function stlBBox(stl: Uint8Array): { w: number; h: number } {
  const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  const n = view.getUint32(80, true);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12; // skip normal
    for (let v = 0; v < 3; v++) {
      const x = view.getFloat32(base + v * 12, true), y = view.getFloat32(base + v * 12 + 4, true);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { w: maxX - minX, h: maxY - minY };
}

describe.runIf(hasWasm)("standalone alignment board (integration)", () => {
  // SCAD tree at the FS root (relative includes resolve), BOSL2, and /fonts.
  const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

  it.each(BOARDS)("renders the %s board alone (board-sized, not the carrier)", async (boardType, size) => {
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
    const { w, h } = stlBBox(result.stl);
    expect(w).toBeCloseTo(size.w, 0);
    expect(h).toBeCloseTo(size.h, 0);
    // The standalone board is screwed on: it carries the pilot holes matching
    // the carrier's footprint (the old omega pattern would miss its material).
    for (const [cx, cy] of size.pilots) expect(wallVertsAt(result.stl, cx, cy, PILOT_R), `pilot at (${cx}, ${cy})`).toBeGreaterThan(0);
    if (boardType !== "omega") expect(wallVertsAt(result.stl, 41, 56.5, PILOT_R)).toBe(0);
  }, 180_000);

  it("pilot holes follow the heat-set screw size (M2.5 → 2.35mm)", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: "omega-d", Film_Format: "35mm", Render_Quality: "final", _Render_Alignment_Board_Only: true,
        Alignment_Board_Type: "lpl-saunders", Heat_Set_Screw_Size: "M2.5" }, quality: "final" },
      log,
    );
    expect(wallVertsAt(result.stl, 68, 35, (2.05 + 0.3) / 2)).toBeGreaterThan(0);
    expect(wallVertsAt(result.stl, 68, 35, PILOT_R)).toBe(0);
  }, 180_000);

  it("a fused lpl-saunders board has no pilot holes (one solid print, no screws)", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: "lpl-saunders-45xx", Film_Format: "35mm", Top_or_Bottom: "bottom", Render_Quality: "final",
        Printed_or_Heat_Set_Pegs: "heat_set", Alignment_Board: true, Alignment_Board_Type: "lpl-saunders", Flip_Bottom_For_Printing: false }, quality: "final" },
      log,
    );
    expect(wallVertsAt(result.stl, 68, 35, PILOT_R)).toBe(0);
    expect(wallVertsAt(result.stl, 68, 35, 1)).toBe(0); // and no carrier footprint hole either
  }, 180_000);

  // Vertices on the plane x = c (or y = c): the cutout's straight walls put many there.
  function wallVertsOnPlane(stl: Uint8Array, axis: "x" | "y", c: number, tol = 0.05): number {
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    const n = view.getUint32(80, true);
    let hits = 0;
    for (let i = 0; i < n; i++) {
      const base = 84 + i * 50 + 12;
      for (let v = 0; v < 3; v++) {
        const x = view.getFloat32(base + v * 12, true), y = view.getFloat32(base + v * 12 + 4, true);
        if (Math.abs((axis === "x" ? x : y) - c) < tol) hits++;
      }
    }
    return hits;
  }

  // The omega board's 4x5 cutout (121 × 97 tall box) and its pilot pattern turn
  // with the sheet on the Omega-D carriers: horizontal (long edge along Y) puts
  // the tall box's 60.5 wall on Y and the pilots at (±56, ±40); vertical puts
  // the wall on X and the pilots at (±40, ±56). The LPL locks 4x5 to horizontal.
  it.each([
    ["omega-d", "horizontal", { wallAxis: "y" as const, pilot: [56, 40] as const, other: [40, 56] as const }],
    ["omega-d", "vertical", { wallAxis: "x" as const, pilot: [40, 56] as const, other: [56, 40] as const }],
    ["lpl-saunders-45xx", "vertical", { wallAxis: "y" as const, pilot: [56, 40] as const, other: [40, 56] as const }],
  ])("omega board for a 4x5 sheet on %s, %s: cutout and pilot holes turn with the effective orientation", async (carrier, orientation, want) => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: carrier, Film_Format: "4x5", Orientation: orientation, Render_Quality: "final",
        _Render_Alignment_Board_Only: true, Alignment_Board_Type: "omega" }, quality: "final" },
      log,
    );
    const { w, h } = stlBBox(result.stl);
    expect(w).toBeCloseTo(127, 0);
    expect(h).toBeCloseTo(127, 0);
    expect(wallVertsOnPlane(result.stl, want.wallAxis, 60.5)).toBeGreaterThan(0);
    expect(wallVertsOnPlane(result.stl, want.wallAxis === "x" ? "y" : "x", 60.5)).toBe(0);
    expect(wallVertsAt(result.stl, want.pilot[0], want.pilot[1], PILOT_R)).toBeGreaterThan(0);
    expect(wallVertsAt(result.stl, want.other[0], want.other[1], PILOT_R)).toBe(0);
  }, 180_000);

  it("omega-d-glass with a vertical sheet: the screw-on board's clearance holes + counterbores turn to (±40, ±56)", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: "omega-d-glass", Film_Format: "4x5", Orientation: "vertical", Render_Quality: "final", _Render_Alignment_Board_Only: true }, quality: "final" },
      log,
    );
    const CLEARANCE_R = 2.4 / 2;      // heat_set_clearance_hole_dia (M2: 2 + 0.4)
    const COUNTERBORE_R = 4.3 / 2;    // M2 socket head 3.8 + 0.5
    for (const [cx, cy] of [[40, 56], [-40, 56], [40, -56], [-40, -56]]) {
      expect(wallVertsAt(result.stl, cx, cy, CLEARANCE_R), `clearance at (${cx}, ${cy})`).toBeGreaterThan(0);
      expect(wallVertsAt(result.stl, cx, cy, COUNTERBORE_R), `counterbore at (${cx}, ${cy})`).toBeGreaterThan(0);
    }
    expect(wallVertsAt(result.stl, 56, 40, CLEARANCE_R)).toBe(0);
    expect(wallVertsOnPlane(result.stl, "x", 60.5)).toBeGreaterThan(0);
  }, 180_000);

  it("omega-d-glass exports its screw-on omega board (127mm), not the carrier", async () => {
    const { factory, wasmBinary } = await loadEngine(process.cwd());
    const log: string[] = [];
    const loadModule = () =>
      factory({ noInitialRun: true, wasmBinary, print: (t: string) => log.push(t), printErr: (t: string) => log.push(t) });
    const result = await renderScad(
      loadModule, fsAssets,
      { params: { Carrier_Type: "omega-d-glass", Film_Format: "4x5", Render_Quality: "final", _Render_Alignment_Board_Only: true }, quality: "final" },
      log,
    );
    const { w, h } = stlBBox(result.stl);
    expect(w).toBeCloseTo(127, 0);
    expect(h).toBeCloseTo(127, 0);
  }, 180_000);
});

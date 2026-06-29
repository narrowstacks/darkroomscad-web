import { buildParamSetJson } from "./params";
import type { RenderRequest, RenderResult } from "./types";

export interface FsFile {
  path: string; // absolute path in the WASM FS, e.g. "/carrier.scad", "/BOSL2/std.scad", "/fonts/..."
  data: Uint8Array;
}

export interface FsAssets {
  files: FsFile[];
}

// loadModule resolves an initialized emscripten OpenSCAD module (noInitialRun:true)
// exposing { FS, callMain } per public/wasm/openscad.d.ts.
export type LoadModule = () => Promise<any>;

const SET_NAME = "web";

function mkdirP(FS: any, dir: string) {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
  }
}

export async function renderScad(
  loadModule: LoadModule,
  fsAssets: FsAssets,
  req: RenderRequest,
  log: string[],
): Promise<RenderResult> {
  const instance = await loadModule();

  // Mount all asset files (SCAD tree, BOSL2, fonts) at their absolute paths.
  for (const file of fsAssets.files) {
    const dir = file.path.slice(0, file.path.lastIndexOf("/"));
    if (dir) mkdirP(instance.FS, dir);
    instance.FS.writeFile(file.path, file.data);
  }

  // Customizer parameter set.
  instance.FS.writeFile("/params.json", buildParamSetJson(req.params, SET_NAME));

  const mainFile = req.mainFile ?? "carrier.scad";
  // Vendored engine is the official prebuilt OpenSCAD 2025.03.25 WASM build
  // (files.openscad.org/playground), which ships the Manifold backend. `--backend=manifold`
  // selects it (faster, robust CSG). `--enable=all` turns on the experimental `textmetrics`
  // feature the carrier relies on for text centering. See VENDORING.md.
  const args = [
    `/${mainFile}`,
    "-o",
    "/out.stl",
    "--backend=manifold",
    "--enable=all",
    "--export-format=binstl",
    "-p",
    "/params.json",
    "-P",
    SET_NAME,
  ];

  const start = (globalThis.performance ?? Date).now();
  let code: number | undefined;
  try {
    code = instance.callMain(args);
  } catch (e) {
    throw new Error(
      `OpenSCAD render threw: ${typeof e === "number" ? `exit ${e}` : (e as Error).message}\n${log.join("\n")}`,
    );
  }
  const durationMs = (globalThis.performance ?? Date).now() - start;

  if (code) throw new Error(`OpenSCAD exited with code ${code}.\n${log.join("\n")}`);

  const out = instance.FS.analyzePath("/out.stl");
  if (!out.exists) throw new Error(`Render produced no output.\n${log.join("\n")}`);
  const stl: Uint8Array = instance.FS.readFile("/out.stl");
  if (stl.byteLength <= 84) throw new Error(`Render produced an empty (degenerate) STL.\n${log.join("\n")}`);

  return { stl, log: log.join("\n"), durationMs };
}

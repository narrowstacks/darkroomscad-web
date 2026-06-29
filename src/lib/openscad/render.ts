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
): Promise<RenderResult> {
  const log: string[] = [];
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
  // Manifold backend invocation (Task 5 spike result): the vendored scadder build is
  // OpenSCAD 2022.03.07, which predates the `--backend` CLI option and the Manifold backend
  // entirely. Passing `--backend=manifold` makes the option parser abort (callMain throws a
  // non-numeric emscripten exit), and `--enable=all` cannot select Manifold because it does not
  // exist in this build — rendering uses the CGAL `fast-csg` backend (confirmed by stderr:
  // "[fast-csg] corefinement ..." / "CGAL Polyhedrons in cache"). So `--backend=manifold` is
  // intentionally omitted. `--enable=all` is still required: it turns on the experimental
  // `textmetrics` feature the carrier relies on. See VENDORING.md / task-5 report: Manifold is a
  // hard project requirement NOT met by this specific build (escalated to the controller).
  const args = [
    `/${mainFile}`,
    "-o",
    "/out.stl",
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

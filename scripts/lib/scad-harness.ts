// Shared Emscripten/OpenSCAD WASM harness for the generator scripts
// (gen-base-stls.ts, gen-carrier-outlines.ts) and the integration tests.
// Consolidates the previously copy-pasted pieces: reading a public/ subtree
// into FS file lists, mkdir-p + mounting them into a module instance, and
// loading the vendored engine factory from public/wasm.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface FsFile {
  path: string; // absolute path in the WASM FS, e.g. "/carrier.scad", "/BOSL2/std.scad"
  data: Uint8Array;
}

// Minimal slice of the Emscripten module instance we actually drive.
export interface EmscriptenFS {
  analyzePath(path: string): { exists: boolean };
  mkdir(path: string): void;
  writeFile(path: string, data: Uint8Array | string): void;
  readFile(path: string): Uint8Array;
}
export interface OpenScadInstance {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
}
export type OpenScadFactory = (opts: {
  noInitialRun?: boolean;
  wasmBinary: Uint8Array;
  print?: (s: string) => void;
  printErr?: (s: string) => void;
}) => Promise<OpenScadInstance>;

// Read a directory subtree into FsFiles rooted at `fsPrefix`. The SCAD tree's
// files must live at the FS ROOT (fsPrefix "") for the carrier's relative
// includes to resolve.
export function readTree(absDir: string, fsPrefix: string): FsFile[] {
  const out: FsFile[] = [];
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const full = join(absDir, e.name);
    if (e.isDirectory()) out.push(...readTree(full, `${fsPrefix}/${e.name}`));
    else out.push({ path: `${fsPrefix}/${e.name}`, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}

export function mkdirP(FS: EmscriptenFS, dir: string): void {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
  }
}

// Mount a list of FsFiles into the module FS, creating parent dirs as needed.
export function mountFiles(FS: EmscriptenFS, files: FsFile[]): void {
  for (const f of files) {
    const dir = f.path.slice(0, f.path.lastIndexOf("/"));
    if (dir) mkdirP(FS, dir);
    FS.writeFile(f.path, f.data);
  }
}

/** Load the vendored engine factory + wasm bytes from public/wasm (cwd-relative). */
export async function loadEngine(
  cwd: string,
): Promise<{ factory: OpenScadFactory; wasmBinary: Uint8Array }> {
  const wasmBinary = new Uint8Array(readFileSync(join(cwd, "public/wasm/openscad.wasm")));
  const mod = await import(join(cwd, "public/wasm/openscad.js"));
  return { factory: (mod.default ?? mod) as OpenScadFactory, wasmBinary };
}

/**
 * The standard mount set: SCAD tree at the FS root (so relative includes
 * resolve), BOSL2 at /BOSL2/..., plus optional fonts (/fonts) and pre-baked
 * base STLs (/base-stls).
 */
export function standardAssets(
  cwd: string,
  opts?: { fonts?: boolean; baseStls?: boolean },
): FsFile[] {
  const files = [
    ...readTree(join(cwd, "public/scad"), ""), // -> FS root
    ...readTree(join(cwd, "public/libraries"), ""), // -> /BOSL2/...
  ];
  if (opts?.fonts) files.push(...readTree(join(cwd, "public/fonts"), "/fonts"));
  if (opts?.baseStls) files.push(...readTree(join(cwd, "public/base-stls"), "/base-stls"));
  return files;
}

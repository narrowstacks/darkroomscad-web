/// <reference lib="webworker" />
import { renderScad, type FsAssets, type FsFile } from "./render";
import { selectRenderTarget } from "./preview-engine";
import type { RenderRequest, RenderResult } from "./types";

declare const self: DedicatedWorkerGlobalScope;

type OpenSCADFactory = (opts: object) => Promise<any>;

let assetsPromise: Promise<FsAssets> | null = null;
// Memoize only the imported factory + the wasm bytes — NOT a module instance.
let enginePromise: Promise<{ factory: OpenSCADFactory; wasmBinary: Uint8Array }> | null = null;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// scad-manifest.json (written by the sync script) lists every asset as
// { url, path } where path is the absolute FS path (root-rooted).
async function loadAssets(): Promise<FsAssets> {
  const manifest = await (await fetch("/scad-manifest.json")).json();
  const files: FsFile[] = await Promise.all(
    manifest.files.map(async (f: { url: string; path: string }) => ({
      path: f.path,
      data: await fetchBytes(f.url),
    })),
  );
  return { files };
}

function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const wasmBinary = await fetchBytes("/wasm/openscad.wasm");
      // Variable specifier keeps tsc from statically resolving the runtime-served URL.
      // webpackIgnore stops webpack (Next's bundler) from treating this as a bundled
      // module — without it, `import(expr)` becomes a context module and fails at
      // runtime with "Cannot find module '/wasm/openscad.js'". @vite-ignore covers Vite.
      const moduleUrl = "/wasm/openscad.js";
      const mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleUrl);
      const factory = (mod.default ?? mod) as OpenSCADFactory;
      return { factory, wasmBinary };
    })();
  }
  return enginePromise;
}

// Create a FRESH OpenSCAD module instance per render. An emscripten module's
// `callMain()` runs `main()` exactly once (it tears down the runtime on exit), so a
// reused instance throws on the second render. The live preview renders many times,
// so each render gets its own instance; only the (expensive) wasm import + bytes are
// shared. `print`/`printErr` bind to this render's `log` directly.
async function createModule(log: string[]) {
  const { factory, wasmBinary } = await loadEngine();
  return factory({
    noInitialRun: true,
    wasmBinary,
    print: (t: string) => log.push(t),
    printErr: (t: string) => log.push(t),
  });
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, req } = e.data as { type: string; id: number; req: RenderRequest };
  if (type !== "render") return;
  const log: string[] = [];
  try {
    if (!assetsPromise) assetsPromise = loadAssets();
    const assets = await assetsPromise;
    // Route preview renders through the fast baked-base path when supported; final
    // renders and unsupported configs fall through to the exact parametric carrier.
    const target = selectRenderTarget(req);
    const routedReq: RenderRequest = { ...req, mainFile: target.mainFile, params: target.params };
    const result: RenderResult = await renderScad(() => createModule(log), assets, routedReq, log);
    result.engine = target.baked ? "baked" : "parametric";
    self.postMessage({ type: "result", id, result }, [result.stl.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id, message: `${(err as Error).message}` });
  }
};

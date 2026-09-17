import { renderScad, type FsAssets, type FsFile } from "./render";
import { selectRenderTarget } from "./preview-engine";
import { filesForTarget } from "./worker-assets";
import type { RenderRequest, RenderResult } from "./types";

type OpenSCADFactory = (opts: object) => Promise<any>;

export interface RenderEngine {
  render(req: RenderRequest): Promise<RenderResult>;
}

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

async function loadEngine() {
  const wasmBinary = await fetchBytes("/wasm/openscad.wasm");
  // Variable specifier keeps tsc from statically resolving the runtime-served URL.
  // webpackIgnore stops webpack (Next's bundler) from treating this as a bundled
  // module — without it, `import(expr)` becomes a context module and fails at
  // runtime with "Cannot find module '/wasm/openscad.js'". @vite-ignore covers Vite.
  const moduleUrl = "/wasm/openscad.js";
  const mod = await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleUrl);
  const factory = (mod.default ?? mod) as OpenSCADFactory;
  return { factory, wasmBinary };
}

// The whole render pipeline (asset + wasm loading, preview routing, per-render
// FS mount, OpenSCAD invocation) behind one `render()`. It runs identically in
// the dedicated worker (the normal path) and on the main thread (the Safari
// fallback in `RenderClient` — WebKit gives worker threads a much smaller
// native stack than the page, and the parametric carrier overflows it).
export function createRenderEngine(): RenderEngine {
  let assetsPromise: Promise<FsAssets> | null = null;
  // Memoize only the imported factory + the wasm bytes — NOT a module instance.
  let enginePromise: ReturnType<typeof loadEngine> | null = null;

  // Create a FRESH OpenSCAD module instance per render. An emscripten module's
  // `callMain()` runs `main()` exactly once (it tears down the runtime on exit), so a
  // reused instance throws on the second render. The live preview renders many times,
  // so each render gets its own instance; only the (expensive) wasm import + bytes are
  // shared. `print`/`printErr` bind to this render's `log` directly.
  async function createModule(log: string[]) {
    if (!enginePromise) enginePromise = loadEngine();
    const { factory, wasmBinary } = await enginePromise;
    return factory({
      noInitialRun: true,
      wasmBinary,
      print: (t: string) => log.push(t),
      printErr: (t: string) => log.push(t),
    });
  }

  return {
    async render(req: RenderRequest): Promise<RenderResult> {
      const log: string[] = [];
      if (!assetsPromise) assetsPromise = loadAssets();
      const assets = await assetsPromise;
      // Route preview renders through the fast baked-base path when supported; final
      // renders and unsupported configs fall through to the exact parametric carrier.
      const target = selectRenderTarget(req);
      const routedReq: RenderRequest = { ...req, mainFile: target.mainFile, params: target.params };
      // Mount only the STLs/fonts this render target can reference — the baked
      // preview path reads exactly one base STL, at most one board STL, and one
      // font; the parametric path reads none. Avoids writing all ~7.3 MB of
      // manifest assets into the fresh per-render FS on every debounced edit.
      const result = await renderScad(
        () => createModule(log),
        { files: filesForTarget(assets.files, target) },
        routedReq,
        log,
      );
      result.engine = target.baked ? "baked" : "parametric";
      return result;
    },
  };
}

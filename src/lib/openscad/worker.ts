/// <reference lib="webworker" />
import { renderScad, type FsAssets, type FsFile } from "./render";
import type { RenderRequest, RenderResult } from "./types";

declare const self: DedicatedWorkerGlobalScope;

let assetsPromise: Promise<FsAssets> | null = null;
let modulePromise: Promise<any> | null = null;
let activeLog: string[] = [];

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// scad-manifest.json (written by the sync script, Step 10) lists every asset as
// { url, path } where path is the absolute FS path (root-rooted, per the test).
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

function loadModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasmBinary = await fetchBytes("/wasm/openscad.wasm");
      // Variable specifier: keeps tsc from statically resolving the runtime-served URL,
      // and @vite-ignore keeps Vite from trying to bundle it.
      const moduleUrl = "/wasm/openscad.js";
      const mod = await import(/* @vite-ignore */ moduleUrl);
      const factory = (mod.default ?? mod) as (opts: object) => Promise<any>;
      // Close over `activeLog` so the callbacks re-read the current reference on
      // every invocation — reassigning `activeLog` before each render routes output
      // to that render's log array without recreating the module.
      return factory({
        noInitialRun: true,
        wasmBinary,
        print: (t: string) => activeLog.push(t),
        printErr: (t: string) => activeLog.push(t),
      });
    })();
  }
  return modulePromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, req } = e.data as { type: string; id: number; req: RenderRequest };
  if (type !== "render") return;
  const log: string[] = [];
  activeLog = log;
  try {
    if (!assetsPromise) assetsPromise = loadAssets();
    const assets = await assetsPromise;
    const result: RenderResult = await renderScad(loadModule, assets, req, log);
    self.postMessage({ type: "result", id, result }, [result.stl.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id, message: `${(err as Error).message}` });
  }
};

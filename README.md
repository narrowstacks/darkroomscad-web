# DarkroomSCAD Web

A browser-based configurator for **DarkroomSCAD** film negative carriers. Pick your enlarger and film format, tweak the geometry, see the part instantly, and export print-ready STLs — no OpenSCAD install required.

> Part of the broader **[Dorkroom](https://github.com/narrowstacks)** project: an open collection of tools for analog photographers and darkroom printers. The carrier geometry itself lives in **[`narrowstacks/DarkroomSCAD`](https://github.com/narrowstacks/DarkroomSCAD)**; this repo is the web frontend that renders and configures it.

## What it does

Negative carriers hold film flat in an enlarger so you can print sharp, edge-to-edge enlargements. Different enlargers (Omega D, Beseler, LPL/Saunders…) take differently-shaped carriers, and different film formats (35mm, 6×4.5, 6×6, 6×7, 6×9, 4×5, custom) need different openings and registration. DarkroomSCAD parametrically generates the right carrier for any combination; this app puts that behind a UI.

Supported enlargers include **Omega D**, **LPL/Saunders 45xx**, **Beseler 23C**, and **Beseler 45**, plus matching alignment boards.

### Two rendering paths

| View | How it works | When it's used |
|------|--------------|----------------|
| **2D** (default) | Pure-TypeScript ports of the OpenSCAD geometry math → SVG. No WASM, instant. | First paint and quick iteration. |
| **3D** | OpenSCAD compiled to WebAssembly → STL → three.js viewer. | Lazily loaded only when you switch to 3D. |

The 3D STL is the ground truth; the 2D path is validated against it. The 3D viewer offers a flat (orthographic) / perspective toggle, raking light and self-shadow so etched text and holes read clearly, and overhead top-down default framing that matches the 2D view.

When you're happy, **export** bundles the part(s) — and optional alignment board — as STLs in a zip.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **three.js** / `@react-three/fiber` / `drei` for the 3D viewer
- **OpenSCAD WASM** running in a Web Worker for STL generation
- **Tailwind CSS v4**
- **Vitest** for tests
- Fully client-side — no serverless functions, no backend. Deploys as static assets on Vercel's CDN.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm test          # vitest
npm run build     # production build (runs the prebuild scad-sync; see below)
npm run lint      # see note in "Known issues"
```

## Project relationship: where the geometry comes from

This repo does **not** own the carrier `.scad` source. `public/scad/**` is **generated/synced** from the canonical repo **[`narrowstacks/DarkroomSCAD`](https://github.com/narrowstacks/DarkroomSCAD)** (carriers under `negative-carriers/`).

```
narrowstacks/DarkroomSCAD          ← canonical geometry (edit here)
  negative-carriers/src/...
        │  scripts/sync-scad.ts
        ▼
darkroomscad-web                   ← this repo (web frontend)
  public/scad/src/...              ← synced copy, do NOT edit directly
```

⚠️ **Never edit `public/scad/*.scad` in this repo** — `sync-scad` overwrites it on the next build, and a `PreToolUse` hook blocks edits to it. To change carrier or board geometry:

1. Edit the `.scad` in a sibling checkout of `narrowstacks/DarkroomSCAD` (`../DarkroomSCAD/negative-carriers/...`, overridable via `DARKROOMSCAD_PATH`).
2. Commit + push to `narrowstacks/DarkroomSCAD`.
3. Re-sync here: `npm run sync:scad` (local checkout) or `npm run sync:scad:github` (pulls the pinned commit in `scripts/scad-source.config.json` — bump its `ref` to a SHA, never a branch).
4. If the change alters a silhouette, regenerate outlines: `npm run gen:outlines`.

The committed `public/scad/**`, parsed param schema, asset manifest, and pre-rendered outlines (`generated/*.json`, `public/outlines/*.svg`) are the **source of record for builds** — Vercel uses them directly and never fetches from GitHub at build time. On CI the `prebuild` sync is a no-op (it warns and exits 0 when no local checkout is present).

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture notes (2D coordinate conventions, outline generation, font handling, WASM/COOP-COEP requirements).

## Architecture at a glance

- `src/app/` — Next.js pages and layout. 2D is the default view; the OpenSCAD worker is created lazily on first 3D selection.
- `src/components/` — UI: `CarrierForm`, `CarrierView2D`, `StlViewer`, `ExportPanel`, controls, theming.
- `src/lib/twod/` — TypeScript ports of the SCAD geometry math (the 2D path).
- `src/lib/openscad/` — WASM render client, worker, param marshalling.
- `src/lib/outline/` — typed loaders for the pre-rendered carrier/board silhouettes.
- `src/lib/export/` — STL part enumeration and zip packaging.
- `scripts/` — `sync-scad.ts` (pull geometry from DarkroomSCAD), `gen-carrier-outlines.ts` (pre-render silhouettes via WASM `projection()`).

## Deployment

Deploys to Vercel with zero config. The app is entirely client-side; the ~9.6 MB `openscad.wasm` and SCAD assets are served as static files from the CDN. The OpenSCAD WASM worker needs cross-origin isolation (`SharedArrayBuffer`), so `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all routes. No environment variables required.

## Known issues

`npm run lint` is **already red** from pre-existing issues unrelated to app code (the vendored `public/wasm/openscad.js`, and two `no-explicit-any` in `scripts/gen-carrier-outlines.ts`). Only new lint errors in changed files are actionable.

## Related projects

- **[narrowstacks/DarkroomSCAD](https://github.com/narrowstacks/DarkroomSCAD)** — the parametric OpenSCAD carrier/board source that this app renders.
- **[Dorkroom](https://github.com/narrowstacks)** — the broader umbrella of open-source darkroom and analog-photography tooling that DarkroomSCAD belongs to.

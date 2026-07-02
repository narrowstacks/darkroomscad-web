# DarkroomSCAD Web

A browser-based configurator for **DarkroomSCAD** film negative carriers. Pick your enlarger and film format, tweak the geometry, see the part instantly, and export print-ready STLs. No OpenSCAD install required.

> Part of the broader **[Dorkroom](https://github.com/narrowstacks)** project, an open collection of tools for analog photographers and darkroom printers. The carrier geometry itself lives in **[`narrowstacks/DarkroomSCAD`](https://github.com/narrowstacks/DarkroomSCAD)**; this repo is the web frontend that renders and configures it.

## What it does

Negative carriers hold film flat in an enlarger so you can print sharp, edge-to-edge enlargements. Different enlargers (Omega D, Beseler, LPL/Saunders) take differently shaped carriers, and different film formats (35mm, 6×4.5, 6×6, 6×7, 6×9, 4×5, custom) need different openings and registration. DarkroomSCAD generates the right carrier for any combination from parameters, and this app puts that behind a UI.

Supported enlargers include **Omega D**, **LPL/Saunders 45xx**, and **Beseler 23C**, plus matching alignment boards. Beseler 45 support is planned but not implemented yet.

### Two rendering paths

| View | How it works | When it's used |
|------|--------------|----------------|
| **2D** (default) | Pure-TypeScript ports of the OpenSCAD geometry math, rendered to SVG. No WASM, instant. | First paint and quick iteration. |
| **3D** | OpenSCAD compiled to WebAssembly, then STL, then a three.js viewer. | Loaded lazily, only when you switch to 3D. |

The 3D STL is the reference the 2D path is validated against. The 3D viewer has a flat (orthographic) / perspective toggle, raking light and self-shadow so etched text and holes read clearly, and an overhead top-down default framing that matches the 2D view.

When you're happy, the export bundles the part or parts, plus an optional alignment board, as STLs in a zip.

## Tech stack

- **Next.js 15** (App Router) with **React 19** and **TypeScript**
- **three.js** / `@react-three/fiber` / `drei` for the 3D viewer
- **OpenSCAD WASM** running in a Web Worker for STL generation
- **Tailwind CSS v4**
- **Vitest** for tests
- Fully client-side, with no serverless functions and no backend. It deploys as static assets on Vercel's CDN.

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm test          # vitest
npm run build     # production build (runs the prebuild scad-sync; see below)
npm run lint      # eslint
```

## Where the geometry comes from

This repo does **not** own the carrier `.scad` source. `public/scad/**` is generated and synced from the canonical repo **[`narrowstacks/DarkroomSCAD`](https://github.com/narrowstacks/DarkroomSCAD)** (carriers under `negative-carriers/`).

```
narrowstacks/DarkroomSCAD          ← canonical geometry (edit here)
  negative-carriers/src/...
        │  scripts/sync-scad.ts
        ▼
darkroomscad-web                   ← this repo (web frontend)
  public/scad/src/...              ← synced copy, do NOT edit directly
```

**Never edit `public/scad/*.scad` in this repo.** `sync-scad` overwrites it on the next build, and a `PreToolUse` hook blocks edits to it anyway. To change carrier or board geometry:

1. Edit the `.scad` in a sibling checkout of `narrowstacks/DarkroomSCAD` (`../DarkroomSCAD/negative-carriers/...`, overridable via `DARKROOMSCAD_PATH`).
2. Commit and push to `narrowstacks/DarkroomSCAD`.
3. Re-sync here with `npm run sync:scad` (local checkout) or `npm run sync:scad:github` (pulls the pinned commit in `scripts/scad-source.config.json`; bump its `ref` to a SHA, never a branch).
4. If the change alters a silhouette, regenerate outlines with `npm run gen:outlines`.

The committed `public/scad/**`, parsed param schema, asset manifest, and pre-rendered outlines (`generated/*.json`, `public/outlines/*.svg`) are the source of record for builds. Vercel uses them directly and never fetches from GitHub at build time. On CI the `prebuild` sync does nothing: it warns and exits 0 when no local checkout is present.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture notes (2D coordinate conventions, outline generation, font handling, and the WASM COOP/COEP requirements).

## Architecture at a glance

- `src/app/`: Next.js pages and layout. 2D is the default view; the OpenSCAD worker is created lazily on first 3D selection.
- `src/components/`: the UI, including `CarrierForm`, `CarrierView2D`, `StlViewer`, `ExportPanel`, controls, and theming.
- `src/lib/twod/`: TypeScript ports of the SCAD geometry math (the 2D path).
- `src/lib/openscad/`: WASM render client, worker, and param marshalling.
- `src/lib/outline/`: typed loaders for the pre-rendered carrier and board silhouettes.
- `src/lib/export/`: STL part enumeration and zip packaging.
- `scripts/`: `sync-scad.ts` pulls geometry from DarkroomSCAD; `gen-carrier-outlines.ts` pre-renders silhouettes via WASM `projection()`.

## Deployment

Deploys to Vercel with zero config. The app is entirely client-side, and the ~9.6 MB `openscad.wasm` plus the SCAD assets are served as static files from the CDN. The OpenSCAD WASM worker needs cross-origin isolation (`SharedArrayBuffer`), so `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all routes. No environment variables required.

## Related projects

- **[narrowstacks/DarkroomSCAD](https://github.com/narrowstacks/DarkroomSCAD)**: the parametric OpenSCAD carrier and board source that this app renders.
- **[Dorkroom](https://github.com/narrowstacks)**: the broader set of open-source darkroom and analog-photography tooling that DarkroomSCAD belongs to.

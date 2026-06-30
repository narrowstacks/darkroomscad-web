# CLAUDE.md — darkroomscad-web

Web configurator for DarkroomSCAD negative carriers. Next.js 15 (App Router) + React 19 + TypeScript. Renders carriers two ways: a 3D path (OpenSCAD WASM → STL → three.js) and an instant 2D path (SVG, no WASM).

## ⚠️ SCAD files are NOT editable here — edit the upstream repo

`public/scad/**` is **generated/synced** from the canonical source repo **`narrowstacks/DarkroomSCAD`** (carriers live under `negative-carriers/`). `scripts/sync-scad.ts` copies that source over `public/scad/` and it runs automatically in `prebuild` (i.e. on every `npm run build`).

**Never edit `public/scad/*.scad` directly — `sync-scad` will overwrite it.** Any change made only here is silently reverted on the next build.

To change carrier/board geometry:
1. Edit the `.scad` in the sibling checkout `../DarkroomSCAD/negative-carriers/...` (path overridable via `DARKROOMSCAD_PATH`).
2. Commit + push to `narrowstacks/DarkroomSCAD`.
3. Re-sync into this repo: `npm run sync:scad` (local checkout) — or `npm run sync:scad:github` (pinned ref in `scripts/scad-source.config.json` — **bump its `ref` to the new commit** when using this path).
4. If the change alters a carrier/board silhouette, regenerate outlines (see below).

Mapping: `public/scad/src/...` ↔ `../DarkroomSCAD/negative-carriers/src/...`.

> Enforced by a `PreToolUse` hook in `.claude/settings.json` that **blocks** Edit/Write on `public/scad/**.scad` and points you at the upstream file. (The guard only covers the edit tools — don't route around it with shell redirects either.)

## 2D view (`src/lib/twod/`, `src/components/CarrierView2D.tsx`)

Pure TS ports of the OpenSCAD geometry math — no WASM. The 3D STL is the ground truth; match it.
- `geometry.ts` / `film-data.ts`: opening dims, peg positions, peg/hole radii, screw footprint, arrow, text placement — ported **exactly** from `public/scad/src/common/*.scad`. Subtle fidelity points that are easy to get wrong (and are pinned by tests in `*.test.ts`):
  - All holes add `PEG_HOLE_TOLERANCE` (0.25) — incl. heat-set holes (radii 1.05 / 2.15, not 0.8 / 1.9).
  - Custom format: the **dominant** peg axis uses the default 37mm width (SCAD calls `get_film_format_width("custom")` without the override); only the peg-distance axis uses `Custom_Film_Width`.
  - Film opening axes: X-extent = `opening_height`, Y-extent = `opening_width` (matches `cuboid([opening_height, opening_width, …])`).
- **Coordinate convention (caused a 2D/3D mismatch bug — keep it straight):** the body/board outline paths come from OpenSCAD's SVG export, which already maps model **+Y → screen-up**. So in `CarrierView2D` they render **raw** (no transform). Features are computed in trueSCAD coords and mapped into that space via `<g transform="scale(1 -1)">`; text uses `translate(cx, -cy) rotate(-deg)`. Don't wrap the body/board in `scale(1,-1)` — that double-flips them.

## Outline generation (`scripts/gen-carrier-outlines.ts` → `npm run gen:outlines`)

Pre-renders carrier + board silhouettes to SVG paths via WASM `projection()`. The **data** is written to `generated/carrier-outlines.json` (carriers; `<key>` = bottom, `<key>:top` = top variant) and `generated/board-outlines.json` (boards; omega has an `omega-4x5` variant), plus visual `public/outlines/*.svg`. All three are committed artifacts. The typed loaders `src/lib/outline/outlines.ts` / `board-outlines.ts` just `import` the JSON and re-export it as `CARRIER_OUTLINES` / `BOARD_OUTLINES` — **those loader .ts files are hand-editable; the JSON and SVGs are not** (a `PreToolUse` hook blocks editing `generated/*.json` and `public/outlines/*.svg`). Notes:
- Manifold (the WASM CSG engine) is intermittently flaky on `projection()` of unions/torus; the generator sweeps `$fn` and validates a min bbox. The beseler **board** (torus) projection sometimes fails — generation is resilient (carriers write `generated/carrier-outlines.json` first; a board failure is caught and leaves `generated/board-outlines.json` untouched).
- Re-run after any silhouette-affecting SCAD change (top vs bottom differ — e.g. the omega **top** part has a corner `separation_hole` notch).

## 3D viewer (`src/components/StlViewer.tsx`)

- Overhead top-down default framing (matches 2D). **Flat (orthographic) / 3D (perspective)** toggle, persisted; ortho is default (no perspective skew).
- Raking key light + self-shadow + under-fill so shallow etched text and holes read with contrast.
- `Flip_Bottom_For_Printing` (default on) rotates the bottom part 180° → its etched face points **down**; etched text is correct but only visible from below or with flip off. This is expected, not a bug.

## App wiring

- 2D is the default view; the OpenSCAD worker is created **lazily** only when 3D is first selected (`src/app/page.tsx`). Toggling 2D⇆3D does not re-render unless the carrier config actually changed (guarded on the memoized `params` ref).
- Bundled etch fonts: TTFs in `public/fonts/` (used by the WASM engine) AND registered as browser `@font-face` (via `bundledFontFaceCss()` in `src/app/layout.tsx`) so the 2D SVG + canvas text measurement use them. `src/config/fonts.ts` is the single source of the font list.
- 2D text width measurement (`src/lib/twod/measure-text.ts`): browser canvas with a deterministic fallback; the component uses the fallback until fonts load to avoid an SSR hydration mismatch.

## Build / test / lint

- `npm test` (vitest), `npm run build` (runs `prebuild` sync-scad — needs `../DarkroomSCAD` or it skips and uses committed artifacts).
- `npm run lint` is **clean**. The vendored `public/wasm/openscad.js` is eslint-ignored (generated Emscripten output, not our code); keep it that way rather than trying to satisfy the linter on it.

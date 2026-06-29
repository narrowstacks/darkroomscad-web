# Vendored Assets

This file records the provenance of all vendored static assets used by the darkroomscad-web render worker.

**Vendored date:** 2026-06-29

---

## OpenSCAD WASM Engine

**Source:** the **scadder** project — https://github.com/solderlocks/scadder
(`web/openscad.js` + `web/openscad.wasm` + `web/openscad.d.ts`, `main` branch).

**Re-vendored:** 2026-06-29 (REPLACES the previously vendored ochafik openscad-playground assets).

**Why this build (not ochafik's playground bundle, not the official openscad/openscad-wasm release):**
Task 4 originally vendored ochafik's playground deployment, but that ships only a
**browser-coupled webpack worker bundle** (`openscad-worker.js` using `importScripts`,
browserfs, and an archive-mounted font zip) — NOT an importable emscripten factory. It cannot
run in Node and therefore cannot back a clean headless test gate. The scadder project commits a
clean, importable, typed emscripten build whose API is exactly
`OpenSCAD({ noInitialRun }) -> { FS, callMain }` (see `openscad.d.ts`). It is an ES module
(`export default OpenSCAD`) and runs identically in a browser Web Worker and in Node (passing
`wasmBinary` so emscripten does not fetch). The official tagged `openscad-wasm` releases remain
stale (last release March 2022, predating Manifold + reliable `textmetrics`), so they are still
unsuitable. Experimental features (including `textmetrics`) are turned on at render time via
`--enable=all`.

The proven working invocation is scadder's `web/scad-worker.js`: factory call
`OpenSCAD({ noInitialRun: true, arguments: ["--enable=all"], print, printErr })`, FS files
written at the root (`/main.scad`, `/fonts/...`), a working `fonts.conf`
(`<fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`), and an
empty-geometry guard (output exists and size > 0).

**License/attribution:** This is an openscad-wasm compile of OpenSCAD (GPL). Attributed to the
scadder project (https://github.com/solderlocks/scadder) and the upstream OpenSCAD project
(https://github.com/openscad/openscad).

**Files vendored:**

| File | Source URL | SHA256 |
|------|-----------|--------|
| `public/wasm/openscad.js` | https://raw.githubusercontent.com/solderlocks/scadder/main/web/openscad.js | `6c77d5ded62848d3ce5d24150aec0b8cee574f18854d2c3c18f224f2706fead0` |
| `public/wasm/openscad.wasm` | https://raw.githubusercontent.com/solderlocks/scadder/main/web/openscad.wasm | `cb3e2cf22050c898e89ddd1b8d09f5ae96671e0a60872f806afeca0cc182657d` |
| `public/wasm/openscad.d.ts` | https://raw.githubusercontent.com/solderlocks/scadder/main/web/openscad.d.ts | `058d946285eca0cf99bf1b2a11219583067fa91edff143e09e4801d72c43b355` |

**WASM magic bytes verification:**
```
xxd -l 4 public/wasm/openscad.wasm
00000000: 0061 736d  .asm
```
Confirmed valid WASM binary (`\0asm` = `00 61 73 6d`).

**Removed (superseded ochafik assets):**
`public/wasm/openscad-worker.js`, `public/wasm/11f7645f8a49daa8a9d6.wasm`,
`public/wasm/openscad.wasm` (ochafik), `public/fonts/fonts.zip`, and the empty
`public/fonts/fonts.conf`.

---

## BOSL2 Library

**Tag:** v2.0.746
**Commit:** 3fe11994ae3ffb5adeda38bdf3fe567e3e704376
**Source:** https://github.com/BelfrySCAD/BOSL2
**Clone command:**
```bash
git clone --depth 1 --branch v2.0.746 https://github.com/BelfrySCAD/BOSL2
```
**Files vendored:** All `.scad` files (56 files) copied to `public/libraries/BOSL2/`
**Resolution:** `include <BOSL2/std.scad>` resolves via `public/libraries/BOSL2/std.scad`

---

## Fonts

### fonts.conf (working fontconfig descriptor)

**Committed path:** `public/fonts/fonts.conf`
**Re-vendored:** 2026-06-29 (replaces the previous empty/useless ochafik descriptor; the
ochafik `fonts.zip` was removed).
**Content:** the scadder pattern that actually resolves fonts in the WASM virtual filesystem:
```xml
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/fonts</dir>
  <cachedir>/fonts/cache</cachedir>
</fontconfig>
```
At render time the worker/test writes the bundled font(s) and this `fonts.conf` under `/fonts/`
in the WASM FS so fontconfig discovers them.

### Liberation Mono (standalone)

**Source:** Extracted from fonts.zip (see above), originally from liberation-fonts project
**License:** SIL Open Font License 1.1
**File:** `public/fonts/LiberationMono-Regular.ttf`
**SHA256:** `a9b21391536aec1c8fad37f2d5f24750e7f2d63cd86bccbb2463b6e17005f52e`
**TTF magic:** `00 01 00 00` (valid TrueType)
**Purpose:** Default font for DarkroomSCAD; remaps proprietary `Lucida Console` to an open equivalent.

---

## Notes for Task 5 (Render Worker)

The render core (`src/lib/openscad/render.ts`) and worker (`src/lib/openscad/worker.ts`) use
the scadder importable factory. FS layout is **root-rooted** so the carrier's relative includes
resolve from cwd `/`:

1. **WASM loading:** `import` the ES module `/wasm/openscad.js` (default export = factory),
   passing the fetched `/wasm/openscad.wasm` bytes as `wasmBinary` so emscripten does not fetch.
   Init with `{ noInitialRun: true, wasmBinary, print, printErr }`.

2. **SCAD tree:** Written at the FS root — `/carrier.scad`, `/src/common/...`, etc. (the
   manifest strips the `scad/` prefix).

3. **Library path:** BOSL2 written at `/BOSL2/...` (manifest strips the `libraries/` prefix) so
   `include <BOSL2/std.scad>` resolves.

4. **Fonts:** The bundled font(s) + `fonts.conf` written under `/fonts/`.

5. **textmetrics / experimental features:** Enabled at render time via `--enable=all` in the
   `callMain` arguments (NOT default-on). This is how `textmetrics` becomes available.

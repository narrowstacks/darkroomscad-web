# Vendored Assets

This file records the provenance of all vendored static assets used by the darkroomscad-web render worker.

**Vendored date:** 2026-06-29

---

## OpenSCAD WASM Engine

**Source:** the **official prebuilt OpenSCAD WASM build** for the OpenSCAD Playground —
`https://files.openscad.org/playground/OpenSCAD-2025.03.25.wasm24456-WebAssembly-web.zip`
(a zip containing `openscad.js` + `openscad.wasm`). This is the exact binary the official
[openscad-playground](https://github.com/openscad/openscad-playground) downloads
(`libs-config.json` → `wasmBuild.url`).

**Build:** OpenSCAD **2025.03.25** (wasm24456). Importable emscripten factory, API
`OpenSCAD({ noInitialRun }) -> { FS, callMain }` — ES module (`export default`), runs identically
in a browser Web Worker and in Node (pass `wasmBinary` so emscripten does not fetch).

**Why this build — and the history:** This build ships the **Manifold backend** (selected via
`--backend=manifold`) AND `textmetrics` (enabled via `--enable=all`) — the project's two hard
requirements — in a clean *importable* factory. Earlier vendoring attempts each failed one
requirement: official tagged `openscad-wasm` releases are stale-2022 (pre-Manifold); ochafik's
`ochafik.com/openscad2` deployment ships only a browser-coupled webpack *worker bundle* (not an
importable factory, not Node-testable); the **scadder** build (`solderlocks/scadder`) is a clean
importable factory but OpenSCAD 2022.03.07 with the CGAL **fast-csg** backend (no Manifold —
`--backend=manifold` aborts). Building `openscad-wasm` from source hit a chain of upstream
breakages (dead GMP mirror; CMake version conflicts on `doubleconversion`/`zlib`). The
`files.openscad.org` prebuilt binary — discovered via the playground's own build config —
sidesteps all of that: a current, Manifold-capable, importable factory available as a direct
download, no compilation.

**Render invocation** (`src/lib/openscad/render.ts`):
`/carrier.scad -o /out.stl --backend=manifold --enable=all --export-format=binstl -p /params.json -P web`.
FS files written at the root (`/carrier.scad`, `/BOSL2/...`, `/fonts/...`); working `fonts.conf`
(`<fontconfig><dir>/fonts</dir><cachedir>/fonts/cache</cachedir></fontconfig>`); empty-geometry
guard (STL > 84 bytes). Verified: the default Omega-D 35mm carrier (with etched text, BOSL2,
Liberation Mono) renders to a valid Manifold STL headlessly in Node and in-browser.

**License/attribution:** A WASM compile of OpenSCAD (GPL), distributed by the OpenSCAD project at
files.openscad.org. Upstream: https://github.com/openscad/openscad.

**Files vendored** (extracted from the zip above; `openscad.d.ts` is the API-compatible type
declaration retained from the scadder build — same `OpenSCAD()->{FS,callMain}` API):

| File | Source | SHA256 |
|------|-----------|--------|
| `public/wasm/openscad.js` | files.openscad.org playground zip (2025.03.25) | `904a47f29e63afb597bedef747da3b457d8ea17cc793c462c6c8b444e918a62e` |
| `public/wasm/openscad.wasm` | files.openscad.org playground zip (2025.03.25) | `f72ce246c02c0e501990837102be383326b153fd761774ebfacce5c80c5ecf26` |
| `public/wasm/openscad.d.ts` | API-compatible type decl (from scadder) | `058d946285eca0cf99bf1b2a11219583067fa91edff143e09e4801d72c43b355` |

**WASM magic bytes verification:** `xxd -l 4 public/wasm/openscad.wasm` → `0061 736d` (`\0asm`).

**Superseded engines (history):** ochafik worker bundle (`openscad-worker.js`,
`11f7645f8a49daa8a9d6.wasm`, `fonts.zip`) removed in Task 5; the scadder fast-csg build
(`openscad.js`/`openscad.wasm` @ sha `6c77d5de…`/`cb3e2cf2…`) replaced by this Manifold build.

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

### Carrier-text font palette (Google Fonts)

User-selectable fonts for the text etched on the carrier (the `Fontface` param). Each is a
**static, regular-weight (400-normal) TTF** vendored from **Fontsource** via jsDelivr —
`https://cdn.jsdelivr.net/fontsource/fonts/<slug>@latest/latin-400-normal.ttf` — which repackages
the upstream Google Fonts files as reliable single-weight static TTFs (preferred over the
variable-font originals for fontconfig + OpenSCAD `textmetrics`). All families are listed in
`src/config/fonts.ts` (`BUNDLED_FONTS`).

Every file was verified to be a real TrueType (magic `00 01 00 00`), its family name read from the
font `name` table, and — critically — **verified to actually render**: `src/config/fonts.integration.test.ts`
renders the default Omega-D 35mm carrier with etched text in each family and asserts a non-empty
binary STL with >0 triangles (proving fontconfig resolves the family AND text geometry renders).
All 12 bundled fonts pass; none were dropped.

| Family (`Fontface` value) | File | Fontsource slug | License |
|---|---|---|---|
| Roboto | `Roboto-Regular.ttf` | `roboto` | Apache-2.0 |
| Open Sans | `OpenSans-Regular.ttf` | `open-sans` | OFL-1.1 |
| Inter | `Inter-Regular.ttf` | `inter` | OFL-1.1 |
| Montserrat | `Montserrat-Regular.ttf` | `montserrat` | OFL-1.1 |
| Lato | `Lato-Regular.ttf` | `lato` | OFL-1.1 |
| Oswald | `Oswald-Regular.ttf` | `oswald` | OFL-1.1 |
| JetBrains Mono | `JetBrainsMono-Regular.ttf` | `jetbrains-mono` | OFL-1.1 |
| Roboto Mono | `RobotoMono-Regular.ttf` | `roboto-mono` | Apache-2.0 |
| Space Mono | `SpaceMono-Regular.ttf` | `space-mono` | OFL-1.1 |
| Bebas Neue | `BebasNeue-Regular.ttf` | `bebas-neue` | OFL-1.1 |
| Playfair Display | `PlayfairDisplay-Regular.ttf` | `playfair-display` | OFL-1.1 |

**Upstream:** Google Fonts (https://github.com/google/fonts), repackaged by Fontsource
(https://github.com/fontsource/font-files). OFL-1.1 and Apache-2.0 both permit embedding/redistribution.

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

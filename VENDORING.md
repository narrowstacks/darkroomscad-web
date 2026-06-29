# Vendored Assets

This file records the provenance of all vendored static assets used by the darkroomscad-web render worker.

**Vendored date:** 2026-06-29

---

## OpenSCAD WASM Engine

**Source:** ochafik's openscad-playground deployment at https://ochafik.com/openscad2/

**Why this build (not the official openscad/openscad-wasm release):**
The official tagged releases on https://github.com/openscad/openscad-wasm/releases are stale
(last release March 2022), predating the Manifold backend and reliable `textmetrics` support —
both hard requirements for DarkroomSCAD. The ochafik playground explicitly defaults to the
Manifold backend and ships a current nightly-tracking WASM build maintained at
https://github.com/openscad/openscad-playground (the `libs/openscad-wasm/` subtree).

**Build provenance:**
- Playground URL: https://ochafik.com/openscad2/
- WASM last-modified: Sun, 26 Jan 2025 15:28:21 GMT (from HTTP response headers)
- Source reference embedded in worker.js: `ochafik/github/openscad-playground/libs/openscad-wasm/openscad.js`
- README confirms: "defaults to the Manifold backend"
- Playground GitHub repo: https://github.com/openscad/openscad-playground

**Files vendored:**

| File | Source URL | SHA256 |
|------|-----------|--------|
| `public/wasm/openscad.wasm` | https://ochafik.com/openscad2/openscad.wasm | `2e53fac1a66071a8a077a002693b6cf3aff96364f23ed5c2809018660560e552` |
| `public/wasm/11f7645f8a49daa8a9d6.wasm` | https://ochafik.com/openscad2/11f7645f8a49daa8a9d6.wasm | `2e53fac1a66071a8a077a002693b6cf3aff96364f23ed5c2809018660560e552` |
| `public/wasm/openscad-worker.js` | https://ochafik.com/openscad2/openscad-worker.js | `f8d256496c62e17b5c52c65bf7b6a87dcaf60dfa909775e753d3ff98b2bbc051` |

**Note on dual WASM filenames:**
`openscad.wasm` and `11f7645f8a49daa8a9d6.wasm` are identical files (same SHA256).
The playground's webpack bundle (`openscad-worker.js`) references the WASM by its content-hash
filename (`11f7645f8a49daa8a9d6.wasm`). The worker determines its public path at runtime from
`self.location` (the worker script's own URL), strips the filename to get the directory, and
appends the hashed WASM filename. Both files must be present at `public/wasm/` for the worker
to resolve the WASM correctly when loaded from `/wasm/openscad-worker.js`.

**WASM magic bytes verification:**
```
xxd -l 4 public/wasm/openscad.wasm
00000000: 0061 736d  .asm
```
Confirmed valid WASM binary (`\0asm` = `00 61 73 6d`).

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

### Font Bundle (for WASM virtual filesystem)

**Source:** https://ochafik.com/openscad2/libraries/fonts.zip
**File:** `public/fonts/fonts.zip`
**SHA256:** `7b0731569b3b815a144fe350b60aa52c12d0b97b3dbfeff0d72a5012f16622f0`
**Contents:** 55 font files (Noto Sans variants + Liberation Mono/Sans/Serif) + `fonts.conf`
**Font dates:** Jan 25, 2025 (most TTFs), Mar 23, 2023 (fonts.conf)

The fonts.zip is the playground's bundled font archive, intended to be mounted in the WASM
virtual filesystem at render time. Task 5's worker should extract and mount this zip.

### fonts.conf

**Source:** Extracted from fonts.zip (see above)
**Committed path:** `public/fonts/fonts.conf`
**Content:** Minimal fontconfig descriptor (empty `<fontconfig>` block — fontconfig uses
default font discovery in the mounted virtual filesystem directory).

**IMPORTANT for Task 5:** The fontconfig file is at `public/fonts/fonts.conf`. When mounting
the virtual filesystem, fonts should be placed at `/fonts/` and fontconfig pointed at
`/fonts/fonts.conf` (or the default fontconfig path that OpenSCAD WASM uses).

### Liberation Mono (standalone)

**Source:** Extracted from fonts.zip (see above), originally from liberation-fonts project
**License:** SIL Open Font License 1.1
**File:** `public/fonts/LiberationMono-Regular.ttf`
**SHA256:** `a9b21391536aec1c8fad37f2d5f24750e7f2d63cd86bccbb2463b6e17005f52e`
**TTF magic:** `00 01 00 00` (valid TrueType)
**Purpose:** Default font for DarkroomSCAD; remaps proprietary `Lucida Console` to an open equivalent.

---

## Notes for Task 5 (Render Worker)

1. **WASM loading:** Load the worker from `/wasm/openscad-worker.js`. The worker auto-detects
   its public path from `self.location`, so both `openscad.wasm` and `11f7645f8a49daa8a9d6.wasm`
   must be accessible at `/wasm/<filename>`.

2. **Library path:** Mount `public/libraries/BOSL2/` at `/libraries/BOSL2/` in the WASM FS
   so that `include <BOSL2/std.scad>` resolves.

3. **Fonts:** Mount `public/fonts/fonts.zip` (or its extracted contents) at `/fonts/` in the
   WASM FS. The `fonts.conf` at `/fonts/fonts.conf` will be used by fontconfig inside WASM.

4. **textmetrics:** The playground WASM build includes the `textmetrics` feature. No special
   flag needed — it is enabled by default in this build.

# 2D View: Dimension Contrast Fix + Film-Format Visualizer

**Date:** 2026-07-02
**Status:** Approved design, ready for implementation plan

## Summary

Two changes to the instant 2D carrier view (`src/components/CarrierView2D.tsx` and
`src/lib/twod/`):

1. **Fix the contrast** of the dimension callout text and lines so they stay
   legible wherever they land (over the mid-grey carrier body, the dark viewer
   field, or the salmon dashed board overlay).
2. **Add a toggleable film-format visualizer** that overlays the *real* film for
   the currently-selected `Film_Format` (135 strip with sprocket holes, 120 roll,
   or 4x5 sheet), so the user can see how much of an actual frame the carrier
   opening reveals.

Both are annotation layers on the existing 2D scene. No 3D / WASM / SCAD changes.

## Non-goals

- No change to the actual carrier geometry, opening math, or peg/hole ports.
- No 4x5 corner notch-code rendering (v1 skip).
- No persistence of the new toggles beyond session state (matches the existing
  `showDims` pattern; persistence is a possible follow-up).
- The visualizer is illustrative of film position/coverage; it is not a
  micron-accurate film datasheet.

---

## Part 1 — Dimension contrast (halo)

### Problem

Dimension lines, ticks, and labels are drawn in `--text-dim` (e.g. `#71717a` in
the dark theme). The callouts stand off *outside* the opening extent, so they
frequently overlap the mid-grey carrier body (`viewer.model`, `#9a9a9a`), giving
very low contrast. A single flat ink color always fights either the grey body or
the dark field.

### Approach: contrasting halo, higher-contrast ink

All changes are confined to the dimension rendering in
`CarrierView2D.tsx` — the `showDimensions && scene.dimensions.map(...)` blocks
(both the line/tick group inside `scale(1 -1)` and the label group in the
unscaled text group). No changes to `scene.dimensions` data.

**Labels:**
- `fill` changes from `var(--text-dim)` → `var(--text)`.
- Add a background-colored halo behind the glyphs using SVG paint-order:
  - `paintOrder="stroke"`, `stroke={viewer.background}`,
    `strokeWidth ≈ 1`, `strokeLinejoin="round"`, `strokeLinecap="round"`.
- The halo means the label reads over any underlying color without a solid box.

**Lines + ticks:**
- Draw a background-colored underlay first (same path/line geometry, wider stroke
  ~1.1 mm, `stroke={viewer.background}`), then the visible stroke on top.
- Bump the visible stroke color from `var(--text-dim)` → `var(--text)` (line
  width stays ~0.3 mm).

`viewer.background` is already available via `useTheme()` (used for `cut`), so no
new theme plumbing is required. The halo approach works in all four themes
(dark, light, darkroom, high-contrast) because it always uses the current
viewer background as the halo color and `--text` as the ink.

### Acceptance

- With Dimensions on, every callout label and line is clearly readable where it
  crosses the grey body, in all four themes.
- No layout/position change to the callouts (same `dimensionLabelPos`,
  `dimensionTicks`, `DIMENSION_OFFSET`).

---

## Part 2 — Film-format visualizer

### Behavior

- A new **"Film"** toggle button appears in the 2D toolbar (`page.tsx`), beside
  the existing "Dimensions" button, same styling and same session-local state
  pattern (`useState(false)`, not persisted).
- The two toggles are independent; both may be on at once.
- When on, the view overlays the real film that corresponds to the selected
  `Film_Format`, registered so **one frame is centered on the opening origin**.
- The film tiles outward along the travel axis to fill the current viewport, so
  multiple frames are visible up/down the strip.
- **Custom format** has no defined real film: the toggle is disabled (with a
  tooltip explaining why) and no overlay is drawn.

### Family mapping

`Film_Format` maps to one of three families:

| Family | Formats | Physical film width (across) | Sprockets | Tiling |
|--------|---------|------------------------------|-----------|--------|
| **135** | `35mm`, `35mm filed`, `35mm full`, `half frame` | 35 mm | yes | yes |
| **120** | `6x4.5`, `6x4.5 filed`, `6x6`, `6x6 filed`, `6x7`, `6x7 filed`, `6x8`, `6x8 filed`, `6x9`, `6x9 filed` | 61 mm (56 mm image) | no | yes |
| **sheet** | `4x5` | single sheet ~101.6 × 127 mm | no | no (one sheet, centered) |
| **(none)** | `custom` | — | — | overlay hidden / toggle disabled |

### Geometry module — `src/lib/twod/film-overlay.ts` (new, unit-tested)

Pure TS, no React/DOM. Follows the same "port the SCAD truth, pin with tests"
discipline as `geometry.ts`. Produces overlay primitives in **trueSCAD coords**
(the caller places them inside the existing `scale(1 -1)` group, exactly like
pegs/opening).

**Coordinate / axis convention** (must match `openingDimensions`):
- Effective orientation comes from `effectiveOrientation(c)` (already exported
  from `geometry.ts`; 4x5 is forced horizontal there).
- **Travel axis** (direction the strip runs / frames repeat):
  - vertical orientation → **X**
  - horizontal orientation → **Y**
- **Across axis** = the other axis (carries the physical film width + sprocket
  rows).
- Image frame dimensions come from a **real recorded-image table** owned by this
  module (`FILM_IMAGE`, see below), **not** from `FILM_FORMATS`. `FILM_FORMATS`
  carries *opening* sizes with baked-in film wiggle (e.g. 35mm opening height is
  37mm = 36mm image + 1mm clearance between the pegs), so using it would draw the
  frame 1mm too tall. The overlay must show the true image so the opening
  visibly reveals that wiggle margin (and, for filed formats, the rebate).
- `image.along` maps to the travel axis, `image.across` to the across axis
  (regardless of orientation — the orientation swap is captured by which screen
  axis is "travel").

**Real recorded-image table (`FILM_IMAGE`, owned by this module):**
`{ along, across }` in mm — the true image on the film, distinct from the
carrier opening. Filed variants keep the same recorded image as their base
(filing reveals the rebate/sprockets in the opening; it does not enlarge the
image):

| Format | along | across |
|--------|-------|--------|
| `35mm`, `35mm filed`, `35mm full` | 36 | 24 |
| `half frame` | 18 | 24 |
| `6x4.5`, `6x4.5 filed` | 41.5 | 56 |
| `6x6`, `6x6 filed` | 56 | 56 |
| `6x7`, `6x7 filed` | 70 | 56 |
| `6x8`, `6x8 filed` | 77 | 56 |
| `6x9`, `6x9 filed` | 84 | 56 |
| `4x5` | (sheet, see below) | |

**Physical constants (135):**
- Film width (across): `35.0 mm`.
- Perforation pitch along travel: `4.7625 mm`.
- Perf hole size: `2.8 mm` (along travel) × `2.0 mm` (across).
- Two perf rows, centered in the margins between the image edge and film edge
  (image across = 24 mm → margin ≈ 5.5 mm each side → row center ≈ ±14.75 mm from
  film center). Rounded corners on holes optional (cosmetic).
- Note the pleasant consistency: 36 mm image + 2 mm inter-frame gap = 38 mm frame
  pitch = exactly 8 perforations (8 × 4.7625 ≈ 38.1), so frames and sprockets
  register.

**Physical constants (120):**
- Film width (across): `61.0 mm` (drawn as the film base); image band width =
  `image.across` (e.g. 56 mm) centered.
- No perforations.

**Sheet (4x5):**
- Single rectangle `101.6 × 127 mm` (4" × 5"), centered on origin, oriented so
  its long edge follows the travel axis (matches 4x5's forced-horizontal opening
  of height 120 / width 95). No tiling, no sprockets, no notch code (v1).

**Frame tiling:**
- Frame pitch along travel = `image.along` + a small inter-frame gap constant
  (135: `2 mm` → 38 mm pitch; 120: ~`3 mm` — cosmetic, tuned in implementation).
- One frame centered on origin; additional frames stepped by ± pitch until they
  exceed the caller-provided travel extent.

**Public API (indicative):**

```ts
export type FilmFamily = "135" | "120" | "sheet" | "none";

export interface FilmSprocket { cx: number; cy: number; w: number; h: number; }
export interface FilmFrame { cx: number; cy: number; w: number; h: number; }

export interface FilmOverlay {
  family: FilmFamily;
  /** Film base rectangle in trueSCAD coords (centered), or null for family "none". */
  base: { w: number; h: number } | null;
  frames: FilmFrame[];      // image-frame boundary rects (empty for "none")
  sprockets: FilmSprocket[]; // 135 only
}

/**
 * Build the film overlay for the config. `travelExtent` is the half-length
 * (mm, SCAD coords) the strip must cover along the travel axis so it fills the
 * viewport; the caller derives it from its viewBox.
 */
export function buildFilmOverlay(c: TwoDConfig, travelExtent: number): FilmOverlay;
```

Notes:
- `family: "none"` (custom) returns an empty overlay; the component also disables
  the toggle so this is belt-and-suspenders.
- The module owns the family mapping (a `Set`/lookup keyed on `Film_Format`),
  reusing `FILM_FORMATS` for image dimensions.

### Rendering — `CarrierView2D.tsx`

- New prop `showFilm?: boolean` (default false), analogous to `showDimensions`.
- Compute the overlay with `useMemo`, passing a travel extent derived from the
  existing `view` box:
  - The `view` box is in export coords (SCAD X; SCAD Y flipped). Derive the
    SCAD-space span for the travel axis (X: `[view.minX, view.minX + view.w]`;
    Y in SCAD: `[-(view.minY + view.h), -view.minY]`) and pass a half-extent big
    enough to cover it.
- Draw the overlay **inside the existing `scale(1 -1)` group**, positioned
  **beneath** the film opening / pegs / screw holes (so the opening still reads
  as the crisp cut on top of the film):
  - **Film base:** `fill = var(--secondary)` at low opacity (~0.12–0.18), thin
    `--secondary` edge stroke. Blue-ish, clearly distinct from the salmon dashed
    board overlay (`--accent`).
  - **Sprocket holes:** `fill = viewer.background` (punched), optional thin edge.
  - **Frame-boundary lines:** thin `var(--secondary)` strokes (~0.3 mm),
    no fill, so the centered frame vs. the opening cut is easy to compare.
- Layer order (bottom → top): body → **film overlay** → opening → pegs →
  screw holes → arrow → dimensions → board overlay → text.
  (Film sits above the body but below the functional cut features so coverage
  reads correctly.)

### Toolbar — `page.tsx`

- Add `const [showFilm, setShowFilm] = useState(false);`.
- Render a second toggle button beside "Dimensions" (only when `viewMode === "2d"`),
  reusing the same pressed/unpressed inline-style pattern.
- Disable it when the selected format is custom
  (`parseConfig(values).filmFormat === "custom"`), with a `title`/tooltip
  explaining custom has no defined film. (Reading the format here is cheap; or
  pass a derived boolean.)
- Pass `showFilm={showFilm}` to `<CarrierView2D>`.

### Acceptance

- Selecting a 35mm-family format and toggling Film on shows a 35 mm-wide strip
  with two sprocket rows and multiple true **24×36 mm** frames at a 38 mm pitch
  tiling along the travel axis; one frame is centered on the opening; the opening
  cut (37 mm) still reads on top and visibly extends ~0.5 mm past the 36 mm image
  on each end (the peg wiggle); sprockets fall outside the opening (over the body
  region) for non-filed formats.
- 120 formats show a 61 mm film band with the image band and tiled frames, no
  sprockets.
- 4x5 shows a single centered sheet, no tiling, no sprockets.
- Custom disables the toggle and draws nothing.
- Rotating orientation (vertical ⇆ horizontal) rotates the strip travel axis
  accordingly and stays registered to the opening.
- Film and Dimensions toggles work independently and together.

---

## Testing

- `film-overlay.test.ts` (new, vitest): pins family mapping, travel-axis
  selection per orientation, frame centering on origin, frame pitch/tiling count
  for a given extent, sprocket row offsets and pitch for 135, film base width per
  family, and `family: "none"` for custom.
- Existing 2D tests remain green (no geometry changes to `geometry.ts` beyond,
  at most, re-exporting an axis helper if convenient).
- Manual: exercise each family + both orientations + all four themes for the
  contrast fix.

## Files touched

- `src/lib/twod/film-overlay.ts` — **new** geometry module.
- `src/lib/twod/film-overlay.test.ts` — **new** tests.
- `src/components/CarrierView2D.tsx` — dimension halo; new `showFilm` prop + film
  overlay rendering.
- `src/app/page.tsx` — new "Film" toggle + wiring.
- (Possibly) `src/lib/twod/geometry.ts` — only if a small helper needs exporting.

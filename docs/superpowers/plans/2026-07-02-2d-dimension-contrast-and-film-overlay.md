# 2D Dimension Contrast + Film-Format Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 2D view's dimension callouts legible over any background, and add a toggleable film-format overlay (135 strip w/ sprockets, 120 roll, 4x5 sheet) that shows how much of the true recorded film image the carrier opening reveals.

**Architecture:** Pure-TS geometry lives in a new `src/lib/twod/film-overlay.ts` (unit-tested like `geometry.ts`), producing overlay rectangles in trueSCAD coords. `CarrierView2D.tsx` renders that overlay inside its existing `scale(1 -1)` group and adds a contrasting halo to the existing dimension layer. `page.tsx` adds a session-local "Film" toggle beside "Dimensions".

**Tech Stack:** Next.js 15 / React 19 / TypeScript, vitest, SVG rendering. Coordinate convention and physical constants are ported from the SCAD sources (see `CLAUDE.md` → "2D view").

## Global Constraints

- **Never edit `public/scad/**.scad`** — geometry is ported into TS by hand (a hook blocks SCAD edits).
- **Coordinate convention:** body/board outlines render raw (OpenSCAD SVG export already maps model +Y → screen-up). Features are computed in trueSCAD coords and placed inside `<g transform="scale(1 -1)">`; text uses the unscaled group with `-cy`. Do NOT wrap features in an extra flip.
- **Real image ≠ opening:** film frames use the module-owned `FILM_IMAGE` table (true recorded image), NOT `FILM_FORMATS` (which carries opening sizes with baked-in peg wiggle, e.g. 35mm = 37mm opening for a 36mm image).
- **Travel axis:** vertical effective orientation → X; horizontal → Y (`effectiveOrientation` from `geometry.ts`; 4x5 is forced horizontal there).
- New toggles are **session-local** (`useState`, not persisted), matching the existing `showDims` pattern.
- `npm run lint` must stay clean; `npm test` must pass; `npx tsc --noEmit` must pass.

---

## Task 1: Dimension contrast halo

Independent, no new module. Improves legibility of the existing `scene.dimensions` layer only. No geometry/data changes.

**Files:**
- Modify: `src/components/CarrierView2D.tsx` (the two `showDimensions && scene.dimensions.map(...)` blocks, ~lines 144-151 and 174-184)

**Interfaces:**
- Consumes: existing `viewer.background` (already destructured as `cut` from `useTheme()`), `scene.dimensions`.
- Produces: nothing consumed by later tasks.

This task has no unit test (the repo has no component-test harness; pure-geometry tasks are the ones tested). Verification is typecheck + lint + a manual visual check.

- [ ] **Step 1: Add a background-colored underlay to the dimension lines + ticks**

In the `scale(1 -1)` group, replace the current dimension line/tick block:

```tsx
{showDimensions && scene.dimensions.map((d, i) => (
  <g key={`dim-${i}`}>
    <line data-layer="dimension" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]}
      stroke="var(--text-dim)" strokeWidth={0.3} />
    <path data-layer="dimension" d={dimensionTicks(d.from, d.to, d.axis)}
      stroke="var(--text-dim)" strokeWidth={0.3} fill="none" />
  </g>
))}
```

with (underlay first, then the bumped-contrast stroke on top):

```tsx
{showDimensions && scene.dimensions.map((d, i) => (
  <g key={`dim-${i}`}>
    {/* Background-colored halo underlay so the callout reads over the grey body. */}
    <line data-layer="dimension" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]}
      stroke={viewer.background} strokeWidth={1.1} strokeLinecap="round" />
    <path data-layer="dimension" d={dimensionTicks(d.from, d.to, d.axis)}
      stroke={viewer.background} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    <line data-layer="dimension" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]}
      stroke="var(--text)" strokeWidth={0.3} />
    <path data-layer="dimension" d={dimensionTicks(d.from, d.to, d.axis)}
      stroke="var(--text)" strokeWidth={0.3} fill="none" />
  </g>
))}
```

- [ ] **Step 2: Give the dimension labels a paint-order halo + high-contrast ink**

Replace the label `<text>` in the unscaled text group:

```tsx
<text key={`dim-label-${i}`} data-layer="dimension"
  transform={`translate(${lx} ${-ly})${d.axis === "y" ? " rotate(-90)" : ""}`}
  textAnchor="middle" dominantBaseline="central"
  fontSize={4} fill="var(--text-dim)">
  {d.label}
</text>
```

with:

```tsx
<text key={`dim-label-${i}`} data-layer="dimension"
  transform={`translate(${lx} ${-ly})${d.axis === "y" ? " rotate(-90)" : ""}`}
  textAnchor="middle" dominantBaseline="central"
  fontSize={4} fill="var(--text)"
  stroke={viewer.background} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round"
  paintOrder="stroke">
  {d.label}
</text>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`, open the app, keep the default omega-d / 35mm carrier, click **Dimensions** on.
Expected: the four callout labels and lines are clearly readable where they cross the grey body; toggle the theme (dark / light / darkroom / high-contrast) — labels stay legible in each because the halo uses the current viewer background.

- [ ] **Step 5: Commit**

```bash
git add src/components/CarrierView2D.tsx
git commit -m "fix(2d): halo dimension callouts for contrast over the carrier body"
```

---

## Task 2: `film-overlay.ts` geometry module

Pure TS + vitest. This is the tested core.

**Files:**
- Create: `src/lib/twod/film-overlay.ts`
- Test: `src/lib/twod/film-overlay.test.ts`

**Interfaces:**
- Consumes: `TwoDConfig` (from `./types`), `effectiveOrientation` (from `./geometry`).
- Produces (relied on by Task 3):

```ts
export type FilmFamily = "135" | "120" | "sheet" | "none";
export type TravelAxis = "x" | "y";
export interface FilmRect { cx: number; cy: number; w: number; h: number; }
export interface FilmOverlay {
  family: FilmFamily;
  travelAxis: TravelAxis;
  base: { w: number; h: number } | null; // centered at origin, trueSCAD coords
  frames: FilmRect[];
  sprockets: FilmRect[];
}
export function filmFamily(format: string): FilmFamily;
export function buildFilmOverlay(c: TwoDConfig, travelExtent: number): FilmOverlay;
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/twod/film-overlay.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filmFamily, buildFilmOverlay } from "./film-overlay";
import type { TwoDConfig } from "./types";

const base: TwoDConfig = {
  carrierType: "omega-d", orientation: "vertical", topOrBottom: "bottom",
  filmFormat: "35mm", customFilmWidth: 37, customFilmHeight: 37,
  customOpeningWidth: 24, customOpeningHeight: 36, pegStyle: "heat_set",
  pegGap: 0, adjustFilmWidth: 0, adjustFilmHeight: 0, alignmentBoard: false,
  alignmentBoardType: "omega", enableOwnerEtch: false, ownerName: "",
  enableTypeEtch: false, typeNameSource: "Carrier Type", customTypeName: "",
  fontFace: "Lucida Console", fontSize: 10, ownerTextOffset: [0, 0], typeTextOffset: [0, 0],
};

describe("filmFamily", () => {
  it("maps 35mm variants + half frame to 135", () => {
    for (const f of ["35mm", "35mm filed", "35mm full", "half frame"]) {
      expect(filmFamily(f)).toBe("135");
    }
  });
  it("maps 6x* to 120", () => {
    for (const f of ["6x4.5", "6x6", "6x6 filed", "6x7", "6x9 filed"]) {
      expect(filmFamily(f)).toBe("120");
    }
  });
  it("maps 4x5 to sheet and custom/unknown to none", () => {
    expect(filmFamily("4x5")).toBe("sheet");
    expect(filmFamily("custom")).toBe("none");
    expect(filmFamily("nonsense")).toBe("none");
  });
});

describe("buildFilmOverlay — 135 vertical", () => {
  const ov = buildFilmOverlay(base, 60);
  it("travel axis is X for vertical", () => {
    expect(ov.travelAxis).toBe("x");
  });
  it("film base is 35mm wide across (Y), spans the travel extent along X", () => {
    expect(ov.base).toEqual({ w: 120, h: 35 });
  });
  it("draws a true 36x24 image frame centered on the origin", () => {
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 36, h: 24 });
  });
  it("tiles frames at a 38mm pitch (36mm image + 2mm gap = 8 perforations)", () => {
    const next = ov.frames.find((f) => Math.abs(f.cx - 38) < 1e-9);
    expect(next).toBeTruthy();
    expect(next!.w).toBe(36);
  });
  it("has two sprocket rows at +/-14.75 across, holes 2.8x2.0 at 4.7625 pitch", () => {
    const rows = new Set(ov.sprockets.map((s) => s.cy));
    expect(rows.has(14.75)).toBe(true);
    expect(rows.has(-14.75)).toBe(true);
    const s0 = ov.sprockets.find((s) => s.cx === 0 && s.cy === 14.75);
    expect(s0).toEqual({ cx: 0, cy: 14.75, w: 2.8, h: 2.0 });
    const s1 = ov.sprockets.find((s) => Math.abs(s.cx - 4.7625) < 1e-9 && s.cy === 14.75);
    expect(s1).toBeTruthy();
  });
});

describe("buildFilmOverlay — orientation + families", () => {
  it("135 horizontal swaps axes (travel Y, frame is 24 wide x 36 tall)", () => {
    const ov = buildFilmOverlay({ ...base, orientation: "horizontal" }, 60);
    expect(ov.travelAxis).toBe("y");
    expect(ov.base).toEqual({ w: 35, h: 120 });
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 24, h: 36 });
  });
  it("filed 35mm keeps the true 36x24 image (filing reveals rebate, not a bigger image)", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "35mm filed" }, 60);
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 36, h: 24 });
  });
  it("120 (6x6) is 61mm wide across, 56x56 frame, no sprockets", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "6x6" }, 80);
    expect(ov.base).toEqual({ w: 160, h: 61 });
    expect(ov.sprockets).toEqual([]);
    const centered = ov.frames.find((f) => f.cx === 0 && f.cy === 0);
    expect(centered).toEqual({ cx: 0, cy: 0, w: 56, h: 56 });
  });
  it("4x5 is a single centered sheet (long edge along travel Y), no frames/sprockets", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "4x5" }, 80);
    expect(ov.travelAxis).toBe("y"); // 4x5 forced horizontal
    expect(ov.base).toEqual({ w: 101.6, h: 127 });
    expect(ov.frames).toEqual([]);
    expect(ov.sprockets).toEqual([]);
  });
  it("custom format returns an empty overlay", () => {
    const ov = buildFilmOverlay({ ...base, filmFormat: "custom" }, 60);
    expect(ov.family).toBe("none");
    expect(ov.base).toBeNull();
    expect(ov.frames).toEqual([]);
    expect(ov.sprockets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- film-overlay`
Expected: FAIL — `Cannot find module './film-overlay'` (module not created yet).

- [ ] **Step 3: Implement `film-overlay.ts`**

Create `src/lib/twod/film-overlay.ts`:

```ts
import type { TwoDConfig } from "./types";
import { effectiveOrientation } from "./geometry";

export type FilmFamily = "135" | "120" | "sheet" | "none";
export type TravelAxis = "x" | "y";

/** A rectangle in trueSCAD mm coords, centered at (cx, cy). */
export interface FilmRect { cx: number; cy: number; w: number; h: number; }

export interface FilmOverlay {
  family: FilmFamily;
  travelAxis: TravelAxis;
  /** Film base rectangle, centered at origin, or null for family "none". */
  base: { w: number; h: number } | null;
  /** True recorded-image frame boundaries. */
  frames: FilmRect[];
  /** 135 perforations only; empty otherwise. */
  sprockets: FilmRect[];
}

// Physical film constants (mm). See spec 2026-07-02.
const FILM_135_WIDTH = 35;          // total 35mm film width (across)
const FILM_120_WIDTH = 61;          // 120 film base width (across); 56mm image band
const PERF_PITCH = 4.7625;          // KS perforation pitch along travel
const PERF_ALONG = 2.8;             // perf hole size along travel
const PERF_ACROSS = 2.0;            // perf hole size across
const PERF_ROW_OFFSET = 14.75;      // sprocket row center from film center (across)
const SHEET_45_LONG = 127;          // 4x5 sheet long edge (5")
const SHEET_45_SHORT = 101.6;       // 4x5 sheet short edge (4")
const GAP_135 = 2;                  // inter-frame gap (135) → 36+2 = 38mm pitch
const GAP_120 = 3;                  // inter-frame gap (120)

// True recorded image (along travel, across) in mm — NOT the carrier opening.
// Filed variants share their base image (filing reveals rebate, not more image).
const FILM_IMAGE: Record<string, { along: number; across: number }> = {
  "35mm": { along: 36, across: 24 },
  "35mm filed": { along: 36, across: 24 },
  "35mm full": { along: 36, across: 24 },
  "half frame": { along: 18, across: 24 },
  "6x4.5": { along: 41.5, across: 56 },
  "6x4.5 filed": { along: 41.5, across: 56 },
  "6x6": { along: 56, across: 56 },
  "6x6 filed": { along: 56, across: 56 },
  "6x7": { along: 70, across: 56 },
  "6x7 filed": { along: 70, across: 56 },
  "6x8": { along: 77, across: 56 },
  "6x8 filed": { along: 77, across: 56 },
  "6x9": { along: 84, across: 56 },
  "6x9 filed": { along: 84, across: 56 },
};

export function filmFamily(format: string): FilmFamily {
  if (format === "half frame" || format.startsWith("35mm")) return "135";
  if (format.startsWith("6x")) return "120";
  if (format === "4x5") return "sheet";
  return "none";
}

export function buildFilmOverlay(c: TwoDConfig, travelExtent: number): FilmOverlay {
  const family = filmFamily(c.filmFormat);
  const travelAxis: TravelAxis = effectiveOrientation(c) === "vertical" ? "x" : "y";
  const empty: FilmOverlay = { family, travelAxis, base: null, frames: [], sprockets: [] };
  if (family === "none") return empty;

  // Place a rect given its position/size along the travel and across axes.
  const rect = (along: number, across: number, alongLen: number, acrossLen: number): FilmRect =>
    travelAxis === "x"
      ? { cx: along, cy: across, w: alongLen, h: acrossLen }
      : { cx: across, cy: along, w: acrossLen, h: alongLen };
  const baseRect = (alongLen: number, acrossLen: number) =>
    travelAxis === "x" ? { w: alongLen, h: acrossLen } : { w: acrossLen, h: alongLen };

  if (family === "sheet") {
    // Single 4x5 sheet, long edge along travel.
    return { ...empty, base: baseRect(SHEET_45_LONG, SHEET_45_SHORT) };
  }

  const img = FILM_IMAGE[c.filmFormat];
  const filmWidth = family === "135" ? FILM_135_WIDTH : FILM_120_WIDTH;
  const gap = family === "135" ? GAP_135 : GAP_120;
  const pitch = img.along + gap;

  const base = baseRect(2 * travelExtent, filmWidth);

  const frames: FilmRect[] = [];
  const nFrames = Math.ceil(travelExtent / pitch);
  for (let k = -nFrames; k <= nFrames; k++) frames.push(rect(k * pitch, 0, img.along, img.across));

  const sprockets: FilmRect[] = [];
  if (family === "135") {
    const nPerf = Math.ceil(travelExtent / PERF_PITCH);
    for (const side of [-1, 1]) {
      for (let m = -nPerf; m <= nPerf; m++) {
        sprockets.push(rect(m * PERF_PITCH, side * PERF_ROW_OFFSET, PERF_ALONG, PERF_ACROSS));
      }
    }
  }

  return { family, travelAxis, base, frames, sprockets };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- film-overlay`
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/twod/film-overlay.ts src/lib/twod/film-overlay.test.ts
git commit -m "feat(2d): film-overlay geometry (135 strip w/ sprockets, 120 roll, 4x5 sheet)"
```

---

## Task 3: Render the film overlay in `CarrierView2D`

**Files:**
- Modify: `src/components/CarrierView2D.tsx`

**Interfaces:**
- Consumes: `buildFilmOverlay`, `FilmOverlay` (Task 2); `effectiveOrientation` (from `geometry.ts`); existing `config`, `view`, `cut` (= `viewer.background`).
- Produces (relied on by Task 4): the component prop `showFilm?: boolean`.

No unit test (component). Verified by typecheck/lint + manual visual check.

- [ ] **Step 1: Add imports + the `showFilm` prop**

At the top of `CarrierView2D.tsx`, extend the geometry import and add the overlay import:

```tsx
import { buildScene, effectiveOrientation } from "@/lib/twod/geometry";
import { buildFilmOverlay } from "@/lib/twod/film-overlay";
```

(The current line is `import { buildScene } from "@/lib/twod/geometry";` — add `effectiveOrientation` to it.)

Change the component signature from:

```tsx
export function CarrierView2D({ values, showDimensions = false }: { values: Record<string, FormValue>; showDimensions?: boolean }) {
```

to:

```tsx
export function CarrierView2D({ values, showDimensions = false, showFilm = false }: { values: Record<string, FormValue>; showDimensions?: boolean; showFilm?: boolean }) {
```

- [ ] **Step 2: Compute the overlay from the view box**

After the `view` `useMemo` block (ends ~line 94), add:

```tsx
  // Film overlay in trueSCAD coords. travelExtent is the half-length the strip
  // must cover along its travel axis to fill the viewport; derive it from the
  // padded view box (X in export coords == SCAD x; SCAD y == -exportY, so the
  // magnitude of the Y span is symmetric either way).
  const filmOverlay = useMemo(() => {
    if (!showFilm) return null;
    const travelExtent = effectiveOrientation(config) === "vertical"
      ? Math.max(Math.abs(view.minX), Math.abs(view.minX + view.w))
      : Math.max(Math.abs(view.minY), Math.abs(view.minY + view.h));
    return buildFilmOverlay(config, travelExtent);
  }, [showFilm, config, view]);
```

- [ ] **Step 3: Render the overlay as the first child of the `scale(1 -1)` group**

Immediately after the opening line `<g transform="scale(1 -1)">` and BEFORE the `{/* Film opening (cut through). */}` path, insert:

```tsx
          {/* Film-format overlay (ghosted): the real film for the selected
              format, registered so one frame is centered on the opening. Drawn
              beneath the opening/pegs so the functional cut still reads on top. */}
          {filmOverlay?.base && (
            <g data-layer="film">
              <rect x={-filmOverlay.base.w / 2} y={-filmOverlay.base.h / 2}
                width={filmOverlay.base.w} height={filmOverlay.base.h}
                fill="var(--secondary)" fillOpacity={0.14}
                stroke="var(--secondary)" strokeOpacity={0.5} strokeWidth={0.4} />
              {filmOverlay.sprockets.map((s, i) => (
                <rect key={`sprocket-${i}`} data-layer="film"
                  x={s.cx - s.w / 2} y={s.cy - s.h / 2} width={s.w} height={s.h} rx={0.4}
                  fill={cut} stroke="var(--secondary)" strokeOpacity={0.5} strokeWidth={0.2} />
              ))}
              {filmOverlay.frames.map((f, i) => (
                <rect key={`frame-${i}`} data-layer="film"
                  x={f.cx - f.w / 2} y={f.cy - f.h / 2} width={f.w} height={f.h}
                  fill="none" stroke="var(--secondary)" strokeOpacity={0.85} strokeWidth={0.3} />
              ))}
            </g>
          )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 5: Manual visual check (temporary force-on)**

Since the toolbar toggle lands in Task 4, temporarily verify by passing `showFilm` from `page.tsx` OR temporarily default it to `true` in the component. Run `npm run dev` and confirm for the default omega-d carrier:
- **35mm:** a 35mm-wide translucent blue strip runs horizontally (vertical orientation → travel X); two rows of punched sprocket holes sit above/below the 24mm image band (outside the opening, over the body); multiple 36×24 frame outlines tile left/right; one frame is centered on the opening and the opening cut reads crisply on top, extending ~0.5mm past the frame on each end.
- Switch **Orientation → horizontal:** the strip runs vertically instead.
- Switch to **6x6:** wider (61mm) strip, no sprockets, 56×56 frames.
- Switch to **4x5:** a single centered sheet, no tiling, no sprockets.
- Switch to **custom:** overlay disappears.
Revert the temporary force-on before committing.

- [ ] **Step 6: Commit**

```bash
git add src/components/CarrierView2D.tsx
git commit -m "feat(2d): render film-format overlay beneath the opening"
```

---

## Task 4: "Film" toggle in the toolbar

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `CarrierView2D`'s `showFilm` prop (Task 3); existing `values`, `viewMode`, `showDims` patterns.
- Produces: nothing consumed by later tasks (final task).

No unit test (component). Verified by typecheck/lint + manual check.

- [ ] **Step 1: Add `showFilm` state + a custom-format guard**

After the existing `const [showDims, setShowDims] = useState(false);` line, add:

```tsx
  const [showFilm, setShowFilm] = useState(false);
  // Custom format has no defined real film — disable the overlay toggle for it.
  const filmDisabled = String(values.Film_Format ?? "") === "custom";
```

- [ ] **Step 2: Add the "Film" toggle button beside "Dimensions"**

In the toolbar `<div className="mb-2 flex items-center justify-end gap-2">`, immediately after the closing `)}` of the existing Dimensions button block (before `<Segmented ...>`), add:

```tsx
            {viewMode === "2d" && (
              <button type="button" aria-pressed={showFilm && !filmDisabled} disabled={filmDisabled}
                onClick={() => setShowFilm((v) => !v)}
                title={filmDisabled ? "Custom format has no defined film to preview" : "Overlay the selected film format"}
                className="rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40"
                style={showFilm && !filmDisabled
                  ? { background: "var(--secondary)", color: "var(--on-primary)", border: "1px solid var(--secondary)" }
                  : { background: "var(--surface-muted)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Film
              </button>
            )}
```

- [ ] **Step 3: Pass `showFilm` to `CarrierView2D`**

Change:

```tsx
              ? <CarrierView2D values={values} showDimensions={showDims} />
```

to:

```tsx
              ? <CarrierView2D values={values} showDimensions={showDims} showFilm={showFilm && !filmDisabled} />
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 5: Manual check**

Run `npm run dev`:
- The **Film** button appears in 2D mode beside **Dimensions**; clicking it toggles the overlay described in Task 3.
- Both toggles work independently and together (Dimensions + Film both on).
- Select **custom** format → the Film button is disabled/greyed with a tooltip and no overlay draws (even if it was on, the `showFilm && !filmDisabled` guard hides it).
- Switch to 3D → both toggle buttons disappear (guarded by `viewMode === "2d"`).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all suites pass (existing 2D tests + the new `film-overlay` suite).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(2d): add Film toggle to the 2D toolbar"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 (dimension halo) → Task 1. Part 2 geometry/`FILM_IMAGE`/families/axes → Task 2. Rendering + layer order + `showFilm` → Task 3. Toolbar toggle + custom-format disable + independence → Task 4. All spec acceptance bullets map to a task's manual-check step or a unit test.
- **Type consistency:** `buildFilmOverlay`/`FilmOverlay`/`FilmRect`/`filmFamily` names are identical across Task 2 (definition) and Task 3 (consumption). `showFilm` prop name identical across Tasks 3 and 4.
- **Real-image invariant:** frames come from `FILM_IMAGE` (36×24 for 35mm), not `FILM_FORMATS` (37×24 opening) — enforced by the Task 2 test "draws a true 36x24 image frame".
- **No component test harness exists** in this repo (only `src/lib/**` is unit-tested); component tasks therefore gate on typecheck/lint + explicit manual observations rather than fabricated render tests. This is deliberate, not a placeholder.

# 2D View Mode — Design Spec

**Date:** 2026-06-29
**Status:** Approved (design); ready for implementation planning.

## Goal

Add a togglable **2D top-down view** of the carrier that renders instantly (no
OpenSCAD/WASM) and updates live as the user edits — including text. It exists so
users can iterate quickly without waiting for the ~10 s WASM cold-load or
per-edit re-renders. The 2D view must match the sizing, spacing, and text
placement of the SCAD geometry (the 3D view remains the ground truth for final
output).

## Decisions (from brainstorming)

1. **Hybrid architecture.** Reuse pre-rendered body/board outlines (static SVG
   paths) and draw all dynamic features (opening, pegs, text, arrows, screw
   holes) live as SVG by porting the SCAD math to TypeScript. No WASM for 2D.
2. **2D is the default mode**, with lazy 3D on demand. Persist the user's last
   choice; first-load defaults to 2D so it is instant.
3. **Render scope:** film opening, peg/hole variants (correct per config),
   alignment-screw footprint holes, directional arrow, **and** the alignment
   board overlay — full fidelity.
4. **Use/design orientation.** Show the carrier top-down as installed in the
   enlarger (Y-up, true to the 3D view). Skip the print-bed transform
   (`Flip_Bottom_For_Printing`) and the Beseler underside text mirror. All other
   feature math (including the Beseler bottom-carrier text Y-swap) is replicated.

## Architecture & data flow

```
form values (Record<string,FormValue>)
        │
        ▼
  parseConfig()  ──►  TwoDConfig (typed)
        │
        ▼
  buildScene(config)  ──►  Scene  (primitives in SCAD mm coords)
        │                    ▲
        │   CARRIER_OUTLINES ─┤  (existing, per carrier type)
        │   BOARD_OUTLINES   ─┘  (new, per board type + omega 4x5 variant)
        ▼
  <CarrierView2D scene outline board theme/>  ──►  SVG
```

The scene is authored in **SCAD millimeter coordinates** (X right, Y up). The
SVG renderer maps SCAD→screen with `(x, y) → (x, -y)` so the view is true to the
3D top-down (Y-up). One shared `viewBox` (derived from the body-outline bbox,
union'd with the board bbox) covers all layers.

## New modules

All new TS lives under `src/lib/twod/` and `src/components/`, following existing
patterns (pure logic in `lib`, React in `components`, colocated `*.test.ts`).

### `src/lib/twod/types.ts`
- `TwoDConfig` — typed projection of the form values the 2D view needs:
  `carrierType`, `orientation`, `topOrBottom`, `filmFormat`, custom dims,
  `pegStyle` (printed/heat_set), `pegGap`, film adjustments, `alignmentBoard`
  (on/off), `alignmentBoardType`, text fields (enable/owner/type/customType/
  typeNameSource), `fontFace`, `fontSize`, text offsets.
- `Scene` — a structured list of primitives in mm (SCAD coords):
  - `opening`: chamfered rect `{ w, h, chamfer }` centered at origin
    (X-extent = `opening_height`, Y-extent = `opening_width`).
  - `pegs`: `{ cx, cy, r, kind }[]` where `kind ∈ {peg, hole}` (peg = filled,
    hole = cut-through styling).
  - `screwHoles`: `{ cx, cy, r }[]` (empty unless board OFF and board type
    omega/lpl).
  - `arrow`: optional polygon `{ points: [x,y][] }` (6×6 / 6×6 filed only).
  - `texts`: `{ value, cx, cy, rotationDeg, fontFace, fontSize, anchor }[]`.

### `src/lib/twod/geometry.ts` (pure; unit-tested)
Faithful ports of the SCAD math. Source-of-truth references in parentheses.

- `parseConfig(values)` → `TwoDConfig`.
- `openingDimensions(config)` → `{ openingHeight, openingWidth }`
  (`get_custom_aware_opening_height/width`, `film-sizes.scad` `FILM_FORMATS`,
  effective orientation via `get_effective_orientation`; 4×5 forces vertical;
  custom uses `Custom_Opening_Height/Width` directly; adjustments added). Opening
  rect: X-extent = `openingHeight`, Y-extent = `openingWidth`, chamfer = 0.5
  (`UNIVERSAL_FILM_OPENING_FRAME_FILLET`).
- `pegPositions(config)` → `{ x, y }` (omega-style,
  `calculate_unified_peg_positions` / `calculate_omega_style_peg_coordinate` /
  `calculate_internal_peg_gap`). Pegs at `(±x, ±y)`.
  - `film_peg_distance` = `get_film_format_peg_distance`.
  - `peg_diameter` = 5.6 (`DEFAULT_PEG_DIAMETER`).
- `pegRadiusAndKind(config)` → drawn radius + kind, by `topOrBottom` × `pegStyle`
  (`carrier-features.scad`):
  - bottom + printed → peg, r = 2.8 (`peg_dia/2`)
  - bottom + heat_set → hole, r = 0.8 (`M2_HEAT_SET_HOLE_DIA/2`, 1.6 dia)
  - top + printed → hole, r = 3.05 (`peg_dia/2 + PEG_HOLE_TOLERANCE` 0.25)
  - top + heat_set → hole, r = 1.9 (`M2_SOCKET_HEAD_DIA/2`, 3.8 dia)
- `screwFootprint(config)` → 4 holes at `(±41, ±56.5)` (`82/2`, `113/2`),
  r = 1 (dia 2). Only when `!alignmentBoard` and board type ∈ {omega, lpl}
  (`generate_universal_alignment_footprint_holes`).
- `arrow(config)` → polygon points + transform, only for 6×6 / 6×6 filed
  (`needs_directional_arrow`, `calculate_arrow_position`, `arrow_etch`;
  `ARROW_LENGTH=8`, `ARROW_WIDTH=5`, internal X offset −10, offset 5).
- `textPlacements(config)` → owner + type placements
  (`calculate_text_position`, `_get_text_settings`, `get_text_rotation`,
  Beseler handle special-case incl. `topOrBottom` Y-swap; user offsets added;
  type-name source via `get_selected_type_name`). Rotation: 270° omega/lpl,
  0° beseler. The default-carrier center uses
  `x_center = carrier_edge − edge_margin − textWidth/2` with `textWidth` from
  the browser metric helper (see Text handling). Text-disabled flags omit
  placements.

### `src/lib/twod/measure-text.ts`
- `measureTextWidthMm(value, fontFace, fontSize)` using a cached canvas 2D
  context with font `${fontSize}px "${fontFace}"`. Returns width in mm
  (1 SCAD unit ≈ 1 px at this sizing). Guarded for SSR (returns an estimate when
  `document` is unavailable; the real measure runs client-side).

### `src/lib/outline/board-outlines.ts` (generated)
- `BOARD_OUTLINES: Record<string, { viewBox; d }>` for `omega`, `omega-4x5`,
  `lpl-saunders`, `beseler-23c`. Unlike `CARRIER_OUTLINES`, board paths keep
  **all** contours (outer outline + opening) with `fill-rule="evenodd"` so the
  board's cutout shows. Generated by extending `scripts/gen-carrier-outlines.ts`
  (new board specs; projection of the board modules; bbox sanity checks as
  today). Omega has two opening variants (4×5 vs other,
  `omega_updown_opening_width`).

### `src/components/CarrierView2D.tsx`
- Props: resolved `values`. Internally derives `TwoDConfig` + `Scene`.
- Container mirrors `StlViewer` styling (rounded panel, `viewer.background`,
  border, theme tokens) so the toggle feels seamless.
- SVG layers, back-to-front:
  1. **Board overlay** (if `alignmentBoard` on): board outline as a distinct
     dashed/tinted underlay (separate part, lower visual weight), opening via
     even-odd.
  2. **Body**: `CARRIER_OUTLINES[carrierType]` path, filled with the model
     color, inside `transform="scale(1 -1)"`.
  3. **Cut features** (opening, holes): drawn as the viewer background color (or
     a "cut" tint) over the body, in the same scaled group.
  4. **Additive features** (printed pegs, arrow): subtle contrast fill.
  5. **Text**: SVG `<text>` in an **unscaled** group; anchor precomputed as
     `(x, -y)`, `transform="rotate(${-rotationDeg} x -y)"`,
     `text-anchor="middle"`, `dominant-baseline="central"`. (Kept out of the
     `scale(1,-1)` group so glyphs are not mirrored.)
- Fit-to-view only (no pan/zoom, no click-to-edit, no dimension annotations).

## Page integration (`src/app/page.tsx`)

- Add `viewMode: "2d" | "3d"` state, default `"2d"`, persisted via the existing
  storage helpers (same pattern as theme/config; new key, e.g. `view-mode`).
- A segmented 2D/3D toggle on the viewer (reuse `Segmented`).
- **Lazy 3D:** keep the existing worker/`PreviewController` creation, but only
  call `controller().request(params)` once 3D has been selected at least once.
  Pure-2D sessions never spawn the worker. On first switch to 3D, the existing
  "Starting the 3D engine…" overlay shows as today.
- 2D renders `<CarrierView2D values={values}/>`; 3D renders the existing
  `<StlViewer/>`. Error banner stays 3D-only.
- Export panel unchanged (already lazily creates its own WASM client).

## Coordinate & rotation conventions

- SCAD→SVG mapping: `(x, y) → (x, -y)`.
- Body/features rendered inside one `scale(1 -1)` group (paths/rects/circles —
  no text). Text rendered in a sibling unscaled group using precomputed
  `(x, -y)` anchors and negated rotation `(-rotationDeg)` so glyphs stay upright.
- Shared `viewBox` = body-outline bbox, expanded to include the board bbox when
  the board overlay is shown.

## Text-metrics approximation (accepted)

Browser font metrics ≠ OpenSCAD FreeType metrics, so glyph shapes and measured
widths differ sub-millimeter. Text **placement/anchoring** follows the SCAD math;
exact glyph rendering will not match. The 3D view remains authoritative for final
output. This is unavoidable without running WASM and is an explicit, accepted
limitation.

## Testing

- TDD on `geometry.ts` (vitest, existing setup):
  - `openingDimensions`: 35mm omega vertical/horizontal; 4×5 (forced vertical);
    6×6; a custom format with explicit opening dims; adjustment offsets.
  - `pegPositions`: 35mm vertical vs horizontal, a filed format (internal-gap
    branch), non-zero `Peg_Gap`, 4×5.
  - `pegRadiusAndKind`: all four top/bottom × printed/heat_set combinations.
  - `screwFootprint`: present only when board off + omega/lpl; positions
    `(±41, ±56.5)`; absent for beseler board type and when board on.
  - `arrow`: present only for 6×6 / 6×6 filed; vertical vs horizontal placement.
  - `textPlacements`: omega/lpl rotation 270 + center formula; beseler handle
    positions and bottom-carrier Y-swap; type-name source resolution; offsets;
    disabled flags omit placements.
- Board-outline generation reuses the projection pipeline's bbox sanity checks
  (throws on dropped features rather than emitting a partial outline).
- Component smoke test: `CarrierView2D` renders an SVG with the expected layer
  groups for a default config (jsdom).

## Out of scope (this round)

**Pinned for the next round of work** (intentionally deferred, planned as a
follow-up):
- **Click-to-edit in 2D** — selecting/dragging features (e.g. text, pegs) in the
  2D view to drive form values.
- **Dimension annotations** — measurement callouts (opening size, peg spacing,
  margins) overlaid on the 2D view.

These influence the `Scene`/`CarrierView2D` boundaries, so the design keeps the
scene a structured list of typed primitives (not flattened SVG) to make both
additions straightforward later.

**Plain YAGNI** (no current plan): pan/zoom, animating between 2D and 3D.

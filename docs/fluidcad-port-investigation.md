# Investigation: porting DarkroomSCAD-web to FluidCAD

**Date:** 2026-07-26
**Subject:** [Fluid-CAD/FluidCAD](https://github.com/Fluid-CAD/FluidCAD) `fluidcad@0.0.40` as a replacement
for the OpenSCAD WASM geometry path, without regressing the non-coder experience.
**Status:** research only — no code changed.

---

## TL;DR

FluidCAD is genuinely better at the *geometry* than OpenSCAD, and measurably so: a comparable
carrier re-renders in **~300 ms** vs the **13.2 s** a full parametric carrier takes today. Its
`param()` registry is a near-perfect structural match for the OpenSCAD Customizer schema this app
already parses, so the form-generation story survives a port intact.

**But it cannot run in the browser today.** Two independent hard blockers, both verified by
inspecting the published package:

1. The engine library is **Node-only** — `FontRegistry.init()` enumerates OS fonts via
   `get-system-fonts`, `io/file-import.js` imports `fs`/`path`, `init()` reads `process.env`, and
   executing a `.fluid.js` goes through a **Vite SSR pipeline**.
2. The only published WASM build (`ocjs-fluidcad@1.1.0`) is **multi-threaded**: its glue creates
   `new WebAssembly.Memory({initial: 2048 pages, maximum: 65536, shared: true})`. Shared memory
   requires `SharedArrayBuffer`, which requires site-wide cross-origin isolation (COOP/COEP). It is
   also **21.8 MB** vs the current `openscad.wasm`'s 9.6 MB, with 128 MB of initial memory.

So "port to FluidCAD" is not a swap. It is either **(a) adding a Node render backend** — abandoning
the zero-backend, everything-client-side model that makes this app cheap and offline-capable — or
**(b) forking a pre-0.1.0 project** to make its engine browser-native.

**Recommendation: don't port now.** The thing FluidCAD would actually fix — 13-second renders — has
a much cheaper fix already half-built in this repo (the baked-base preview path). Revisit when
FluidCAD ships a browser-native engine build; the concrete signals to watch are listed at the end.

Crucially: **none of this is what makes the app friendly to non-coders.** That lives in the React
layer, and it is engine-independent. See [The non-coder question](#the-non-coder-question).

---

## What FluidCAD actually is

Measured against the published `fluidcad@0.0.40` tarball and a working headless install.

| | |
|---|---|
| Language | JavaScript (`.fluid.js`), sketch → extrude → fillet/shell/boolean, feature-history model |
| Kernel | OpenCascade (OCCT) **B-rep** via `ocjs-fluidcad`, a custom trimmed opencascade.js fork |
| License | MIT (engine); OCCT wasm is LGPL-2.1 **with** the Open CASCADE Exception |
| Maturity | v0.0.40, first real release 2026-04-10, ~40 releases in 3.5 months, effectively solo-authored |
| Contributions | README: not accepting PRs until v0.1.0; "APIs and features may change" |
| Shape | An **application** — CLI, Express+WS server, Vite-built browser viewer, VS Code/Neovim extensions, MCP server — that also publishes a library entry point |
| Docs | 51 API pages + 4 concept pages bundled as `llm-docs/` in the package (genuinely good) |

The published entry points are `fluidcad` (lib), `fluidcad/core` (the modeling DSL),
`fluidcad/server/api` (headless engine), `fluidcad/filters`, `fluidcad/math`.

### How it renders

The browser bundle it ships (`ui/dist`, 1.2 MB) is a **three.js viewer**, not a kernel. Geometry is
built in Node and meshes are pushed to the viewer over a WebSocket. That is the inverse of this
app's architecture, where the kernel runs client-side in a Worker and no server computes anything.

---

## Measured performance

All numbers from this container, same machine, same session.

**Current OpenSCAD path** (`scripts/lib/scad-harness`, omega-d / 35mm / bottom, no board):

```
PARAMETRIC carrier   boot   62 ms   render 13208 ms   stl 729,680 B
BAKED preview path   boot   67 ms   render  5956 ms   stl 536,436 B
```

**FluidCAD headless** (`FluidCadServer` + `LocalSceneHost`), on a hand-written stand-in carrier —
rounded plate, film gate, 4 peg holes, etched text, all parameterised:

```
boot (OCCT wasm + font index)      ~700 ms
cold render (incl. Vite transform) ~1250 ms
param change → re-render            276–437 ms
STL export (fine, 664 KB)             33 ms
```

The stand-in model is simpler than a real carrier, so treat ~300 ms as a floor rather than a
prediction. Even discounted heavily, the gap is an order of magnitude, and it is **architectural,
not incidental**: FluidCAD diffs the feature tree and rebuilds only what changed, whereas OpenSCAD
re-parses and re-evaluates the entire program on every render.

### `project()` works, and would fix a known flake

`CLAUDE.md` documents that Manifold is "intermittently flaky on `projection()` of unions/torus",
that the generator has to sweep `$fn` and validate a bbox, and that the beseler board projection
sometimes fails outright. FluidCAD's `project()` produced a clean silhouette wire from a
circle-fused-with-rect body with holes, first try, in a 642 ms render.

Because it is B-rep, the output is **exact arcs and lines**, not a faceted polyline. The committed
`generated/*-outlines.json` and `public/outlines/*.svg` would get smaller and smoother, and
`gen-carrier-outlines.ts` would lose its retry machinery. This is the second-strongest argument for
the port after raw speed.

---

## The blockers, verified

### 1. The engine library is Node-only

```js
// lib/dist/index.js
export async function init(options) {
    await Promise.all([loadOC(), FontRegistry.init()]);
    ...
    const resolvedPath = process.env.FLUIDCAD_WORKSPACE_PATH || '';
```

- `FontRegistry.init()` → `get-system-fonts` walks OS font directories. In this container it logged
  `indexed 22 families from 49 files`. There is **no public API to register a font from bytes** —
  `.font("Foo.ttf")` routes through `readWorkspaceAssetBytes`, which the `setAssetProvider` hook
  *can* serve, but `init()` still hard-requires the system scan first.
- `lib/dist/io/file-import.js` imports `fs` and `path` at module scope.
- `captureParamDefinitions` describes its own cost: "constructs its own `FluidCadServer` (which
  boots OC wasm **+ a Vite SSR pipeline**)".

`setAssetProvider` is a real seam and is explicitly there for a hosted "hub" mode, so the project is
clearly moving toward decoupling from the filesystem. It just isn't there yet.

The Vite dependency is the *least* of these for our case: this app ships one fixed model, so it
could be bundled at build time with esbuild and imported statically. Fonts and `fs` are the wall.

### 2. Shared memory forces cross-origin isolation

`ocjs-fluidcad@1.1.0` publishes exactly one artifact:

```json
"exports": { "./wasm": "./dist/opencascade.fluidcad.multi-threaded.wasm" }
```

and its glue contains `new WebAssembly.Memory({initial:(h.INITIAL_MEMORY||134217728)/65536, maximum:65536, shared:!0})`.

Consequences if shipped to browsers as-is:

- **COOP `same-origin` + COEP `require-corp` site-wide.** Every cross-origin subresource then needs
  CORP/CORS headers — `@vercel/analytics` among them — and the site can no longer be embedded in a
  third-party iframe.
- **21.8 MB** WASM download (2.3× today's 9.6 MB) plus **128 MB** initial memory, allocated as a
  SharedArrayBuffer. For a darkroom user on a phone, that is a meaningful regression, and mobile
  Safari may simply fail the allocation.

This one is *fixable in principle*: upstream `opencascade.js@1.1.1` ships a single-threaded build
with no `SharedArrayBuffer` reference at all, so the toolchain supports it. `ocjs-fluidcad` is a
custom symbol-trimmed build (there's a `yaml_config: fluidcad_multi.yml` in its build manifest);
a `fluidcad_single.yml` sibling is a build-config change, not a code change. But producing and
maintaining that build is on us unless upstream publishes it.

---

## What a port would cost

Rough inventory against the current tree.

| Area | LOC (excl. tests) | Fate under a port |
|---|---|---|
| `src/components` | 1,207 | **Survives.** Form, pickers, presets, export panel, theme — engine-agnostic. |
| `src/lib/form`, `src/config` | 360 | **Survives**, minus the schema adapter. |
| `src/lib/params` (customizer parser) | 148 | **Deleted** — FluidCAD emits `ParamDefinition[]` directly, no parsing needed. Net win. |
| `src/lib/openscad` (worker, render, preview-engine) | 441 | **Rewritten** against whatever the new engine transport is. |
| `src/lib/export` | 175 | Mostly survives; STL comes from `exportShapes` instead of `callMain`. |
| `src/lib/twod` | 650 | **Re-derived.** Pure-TS ports of the SCAD math, pinned by tests to OpenSCAD's exact behaviour. |
| `scripts/` (sync, outlines, base STLs) | 779 | `sync-scad` and `gen-base-stls` become obsolete; `gen-carrier-outlines` rewritten around `project()` (and gets simpler). |
| `public/scad/**` (~2,260 LOC of carrier SCAD) | — | **Rewritten as `.fluid.js`.** |

Three costs deserve calling out because they are easy to underestimate:

**The upstream repo is the real deliverable.** `narrowstacks/DarkroomSCAD` is the canonical source
and this repo only syncs from it. Porting the geometry means the upstream project stops being an
OpenSCAD project. Everyone who currently opens the `.scad` in OpenSCAD, remixes it on Printables, or
runs it through the Customizer loses that. For a hobbyist 3D-printing project, OpenSCAD *is* the
lingua franca — that is a community cost the web app's render speed doesn't pay for.

**The 2D path has to be re-derived, not ported.** `src/lib/twod` is validated against OpenSCAD's
exact semantics, and `CLAUDE.md` records how fiddly that was. Text is the sharp edge: OpenSCAD's
`text(size=s)` is an em at `s × 100/72`, positioned by ink-width textmetrics with ink-bbox centring
— all three mirrored in the SVG path. FluidCAD's `.size()` is **cap height in mm**. Different
metric, different anchor, so every text position and the `SCAD_TEXT_EM_SCALE` machinery is
recalculated from scratch, and the `*.test.ts` fixtures that pin 2D↔3D fidelity are all invalidated.

**BOSL2 has no equivalent.** The carriers lean on `cuboid`/`cyl` with `anchor`/`position`
attachment (~135 call sites) plus `rounding=`/`edges=`/`chamfer=`. FluidCAD's sketch→extrude→fillet
model expresses this differently — arguably better, since fillets on a B-rep are exact instead of
faceted — but there is no mechanical translation. Every module is rethought by hand.

---

## The non-coder question

This is the part worth being blunt about: **the geometry kernel is not what makes this app friendly
to non-coders, and changing it neither helps nor hurts that.**

What actually delivers the non-coder experience today is all in React and all engine-independent:
`CarrierForm`, `CardSelect`, `FilmFormatPicker`, `PresetMenu`, permalinks, the theme system, the
export panel — and above all the **instant 2D view**, which is pure TypeScript and needs no kernel
at all. A user picks an enlarger and a film format and sees the part immediately. They never see
code, in either language.

Two nuances cut in opposite directions:

- **In FluidCAD's favour:** `param()` is a first-class, typed API — `label`, `defaultValue`,
  `controlType` (`slider`/`select`/`checkbox`/`color`/`text`/`number`), `min`/`max`/`step`,
  `options`, `group`, `description` — returned as structured `ParamDefinition[]` from a render. That
  is strictly better than regex-parsing `// [min:max]` comments out of `.scad` source, and it maps
  onto this app's existing form model almost field-for-field. `src/lib/params/parse-customizer.ts`
  (148 LOC of comment parsing) would simply go away. FluidCAD is also clearly building toward this
  use case: `fluidcad publish` captures a param schema into a package manifest "so the hub can build
  param forms without a live worker."
- **Against:** param definitions only exist **after** a render, by design ("the packer/bundler never
  executes user code"). Today the schema is committed as `generated/param-schema.json` and the UI
  is fully interactive before any WASM loads. Under FluidCAD that schema has to be captured at build
  time and committed — doable, and the `publish` flow does exactly this, but it is new pipeline.

Net: the param story is a modest improvement, and it is not remotely worth a rewrite on its own.

---

## Options

**A. Don't port. Finish the baked-preview path.** The problem FluidCAD solves is that a full
parametric render takes 13.2 s. `carrier-baked.scad` already cuts that to 6.0 s by importing
pre-baked base STLs, and `preview-engine.ts` already routes preview renders through it. Pushing
more parameter-independent geometry into the bake, and mounting fewer assets per render, attacks
the same number for days of work instead of months — with no community fork, no 22 MB download, no
COOP/COEP, and no re-derivation of the 2D path.

**B. Port with a Node render backend.** Run `FluidCadServer` behind a Next.js route or a small
service. Renders are fast (~300 ms) and the browser downloads meshes rather than a kernel — good
for mobile. But it ends the zero-backend model: hosting cost, cold starts, an execution sandbox for
model code, no offline use, and a per-user render queue. This is a different product with different
economics.

**C. Port with a browser-native FluidCAD.** The architecturally right answer, and currently blocked
on work in someone else's pre-0.1.0 repo: a single-threaded `ocjs-fluidcad` build, a browser
`FontRegistry` that takes font bytes, and an `fs`-free `file-import`. Forking to do this ourselves
means owning an emscripten/OCCT build pipeline and re-forking on every one of their ~3-releases-a-week.

**D. Hybrid: keep OpenSCAD, adopt FluidCAD for outline generation only.** `gen-carrier-outlines.ts`
runs in Node at build time, where FluidCAD's Node-only constraint costs nothing, and the flaky
Manifold `projection()` is the single worst-behaved part of the current pipeline. This is the one
place FluidCAD could be adopted today at low risk — but it means maintaining carrier silhouettes in
two languages, which is a bad trade unless the flakiness gets worse.

---

## Recommendation

**Option A.** Treat FluidCAD as a strong candidate for a *future* rewrite, not a present port. The
speed and B-rep advantages are real and measured, but they buy an improvement to the 3D path, which
is already the lazily-loaded secondary view — while the costs land on the upstream community, the
2D fidelity work, and the deployment model.

Revisit when **all three** of these are true:

1. `ocjs-fluidcad` publishes a **single-threaded** build (kills the COOP/COEP and SharedArrayBuffer
   requirement), and the WASM is small enough to ship to a phone.
2. FluidCAD's lib runs in a browser Worker — concretely: `FontRegistry` accepts font bytes and
   `io/file-import` no longer imports `fs` at module scope.
3. The project reaches **v0.1.0** and starts accepting contributions, so a bug in the kernel is
   something we can fix rather than wait on.

Until then the highest-value work is finishing the baked-preview path and, if outline generation
starts failing more often, evaluating Option D in isolation.

---

## Reproducing the measurements

The OpenSCAD numbers come from driving `scripts/lib/scad-harness` directly:

```ts
const { factory, wasmBinary } = await loadEngine(cwd);
mountFiles(mod.FS, standardAssets(cwd, { fonts: true, baseStls: true }));
mod.FS.writeFile("/params.json", JSON.stringify({ parameterSets: { s: params }, fileFormatVersion: "1" }));
mod.callMain(["/carrier.scad", "-o", "/out.stl", "--enable=manifold", "-p", "/params.json", "-P", "s"]);
```

The FluidCAD numbers come from `npm i fluidcad@0.0.40`, `npx fluidcad init`, and:

```js
import { FluidCadServer, LocalSceneHost } from "fluidcad/server/api";
const server = new FluidCadServer(new LocalSceneHost());
await server.init(process.cwd());
await server.processFile("carrier.fluid.js");
server.setParam("carrier.fluid.js", "Film opening width", 50);
await server.recomputeCurrentFile(true);   // <- the 276–437 ms figure
```

Note `server.setParam(...)` + `recomputeCurrentFile()` is the correct override path;
`getParamRegistry().setOverrides()` has no effect, because each render calls `createParamRegistry()`
and seeds it from the server's own per-session override map.

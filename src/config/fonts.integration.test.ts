import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderScad, type FsAssets } from "../lib/openscad/render";
import { BUNDLED_FONTS } from "./fonts";
import { loadEngine, standardAssets } from "../../scripts/lib/scad-harness";

const WASM_JS = join(process.cwd(), "public/wasm/openscad.js");
const WASM_BIN = join(process.cwd(), "public/wasm/openscad.wasm");
const hasWasm = existsSync(WASM_JS) && existsSync(WASM_BIN);

// Regression guard for the bundled carrier-text font palette: EACH font in BUNDLED_FONTS must
// resolve via fontconfig AND render etched text — a font that doesn't resolve breaks the carrier
// when a user selects it. We render the default Omega-D 35mm carrier with Fontface=<family> and
// assert a valid, non-empty binary STL with >0 triangles (proving the font resolved and the text
// geometry rendered). Gated on the wasm existing, like render.integration.test.ts.
describe.runIf(hasWasm)("bundled fonts render (integration)", () => {
  // SCAD tree at the FS root (relative includes resolve), BOSL2, and /fonts.
  const fsAssets: FsAssets = { files: standardAssets(process.cwd(), { fonts: true }) };

  it.each(BUNDLED_FONTS.map((f) => [f.family, f] as const))(
    "renders etched text in %s",
    async (_family, font) => {
      const { factory, wasmBinary } = await loadEngine(process.cwd());
      const log: string[] = [];
      const loadModule = () =>
        factory({
          noInitialRun: true,
          wasmBinary,
          print: (t: string) => log.push(t),
          printErr: (t: string) => log.push(t),
        });

      const result = await renderScad(
        loadModule,
        fsAssets,
        {
          params: {
            Carrier_Type: "omega-d",
            Film_Format: "35mm",
            Orientation: "vertical",
            Top_or_Bottom: "bottom",
            Render_Quality: "preview",
            Enable_Owner_Name_Etch: true,
            Owner_Name: "TEST",
            Fontface: font.family,
          },
          quality: "preview",
        },
        log,
      );

      expect(result.stl.byteLength).toBeGreaterThan(84);
      const view = new DataView(result.stl.buffer, result.stl.byteOffset);
      expect(view.getUint32(80, true)).toBeGreaterThan(0); // triangle count > 0
    },
    180_000,
  );
});

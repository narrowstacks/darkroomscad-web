import { describe, it, expect } from "vitest";
import { filesForTarget } from "./worker-assets";
import type { FsFile } from "./render";
import type { RenderTarget } from "./preview-engine";
import { BUNDLED_FONTS, DEFAULT_FONT_FAMILY } from "@/config/fonts";

const f = (path: string): FsFile => ({ path, data: new Uint8Array([1]) });

const ALL_STLS = [
  "/base-stls/beseler-23c-bottom.stl",
  "/base-stls/beseler-23c-top.stl",
  "/base-stls/board-beseler-23c.stl",
  "/base-stls/board-lpl-saunders.stl",
  "/base-stls/board-omega-4x5.stl",
  "/base-stls/board-omega.stl",
  "/base-stls/lpl-saunders-45xx-bottom.stl",
  "/base-stls/lpl-saunders-45xx-top.stl",
  "/base-stls/omega-d-bottom.stl",
  "/base-stls/omega-d-top.stl",
];

const NON_STL = [
  "/carrier.scad",
  "/carrier-baked.scad",
  "/src/common/carrier.scad",
  "/BOSL2/std.scad",
  "/fonts/fonts.conf",
];

const ALL_FONTS = BUNDLED_FONTS.map((bf) => `/fonts/${bf.file}`);

const files: FsFile[] = [...ALL_STLS, ...NON_STL, ...ALL_FONTS].map(f);

const paths = (out: FsFile[]) => out.map((x) => x.path);

describe("filesForTarget", () => {
  it("baked target keeps exactly its referenced STLs and drops the other 8", () => {
    const target: RenderTarget = {
      mainFile: "carrier-baked.scad",
      baked: true,
      params: {
        Baked_Base_Stl: "/base-stls/omega-d-bottom.stl",
        Baked_Board_Stl: "/base-stls/board-omega.stl",
      },
    };
    const kept = paths(filesForTarget(files, target)).filter((p) => p.startsWith("/base-stls/"));
    expect(kept.sort()).toEqual(
      ["/base-stls/board-omega.stl", "/base-stls/omega-d-bottom.stl"].sort(),
    );
  });

  it("parametric target drops all /base-stls/*", () => {
    const target: RenderTarget = {
      mainFile: "carrier.scad",
      baked: false,
      params: { Carrier_Type: "omega-d" },
    };
    const kept = paths(filesForTarget(files, target)).filter((p) => p.startsWith("/base-stls/"));
    expect(kept).toEqual([]);
  });

  it("always keeps non-STL paths (SCAD sources, BOSL2, fonts.conf)", () => {
    const target: RenderTarget = { mainFile: "carrier.scad", baked: false, params: {} };
    const out = paths(filesForTarget(files, target));
    for (const p of NON_STL) expect(out).toContain(p);
  });

  it("keeps the requested Fontface + default face, drops other fonts", () => {
    const nonDefault = BUNDLED_FONTS.find((bf) => bf.family !== DEFAULT_FONT_FAMILY)!;
    const target: RenderTarget = {
      mainFile: "carrier-baked.scad",
      baked: true,
      params: {
        Baked_Base_Stl: "/base-stls/omega-d-bottom.stl",
        Fontface: nonDefault.family,
      },
    };
    const kept = paths(filesForTarget(files, target)).filter(
      (p) => p.startsWith("/fonts/") && p.endsWith(".ttf"),
    );
    const defaultFile = BUNDLED_FONTS.find((bf) => bf.family === DEFAULT_FONT_FAMILY)!.file;
    expect(kept.sort()).toEqual(
      [`/fonts/${nonDefault.file}`, `/fonts/${defaultFile}`].sort(),
    );
  });

  it("keeps only the default face when no Fontface is set", () => {
    const target: RenderTarget = { mainFile: "carrier.scad", baked: false, params: {} };
    const kept = paths(filesForTarget(files, target)).filter(
      (p) => p.startsWith("/fonts/") && p.endsWith(".ttf"),
    );
    const defaultFile = BUNDLED_FONTS.find((bf) => bf.family === DEFAULT_FONT_FAMILY)!.file;
    expect(kept).toEqual([`/fonts/${defaultFile}`]);
  });
});

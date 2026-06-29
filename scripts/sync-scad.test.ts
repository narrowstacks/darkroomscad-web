import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectScadFiles, collectManifestFiles } from "./sync-scad";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "scad-"));
  mkdirSync(join(dir, "src", "common"), { recursive: true });
  writeFileSync(join(dir, "carrier.scad"), "// main");
  writeFileSync(join(dir, "src", "carrier-configs.scad"), "// cfg");
  writeFileSync(join(dir, "src", "common", "film-sizes.scad"), "// films");
  writeFileSync(join(dir, "src", "notes.txt"), "ignore me");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("collectScadFiles", () => {
  it("returns all .scad files recursively, relative to root", () => {
    const files = collectScadFiles(dir).sort();
    expect(files).toEqual([
      "carrier.scad",
      "src/carrier-configs.scad",
      "src/common/film-sizes.scad",
    ]);
  });
});

describe("collectManifestFiles", () => {
  it("root-roots scad FS paths and excludes src/old/**", () => {
    const oldDir = mkdtempSync(join(tmpdir(), "scadpub-"));
    mkdirSync(join(oldDir, "scad", "src", "old"), { recursive: true });
    mkdirSync(join(oldDir, "scad", "src", "common"), { recursive: true });
    writeFileSync(join(oldDir, "scad", "carrier.scad"), "// main");
    writeFileSync(join(oldDir, "scad", "src", "common", "film-sizes.scad"), "// films");
    writeFileSync(join(oldDir, "scad", "src", "old", "omega-d.scad"), "// legacy");

    const files = collectManifestFiles(
      oldDir,
      "scad",
      (rel) => `/${rel}`,
      (rel) => rel === "src/old" || rel.startsWith("src/old/"),
    ).sort((a, b) => a.path.localeCompare(b.path));

    expect(files).toEqual([
      { url: "/scad/carrier.scad", path: "/carrier.scad" },
      { url: "/scad/src/common/film-sizes.scad", path: "/src/common/film-sizes.scad" },
    ]);
    expect(files.some((f) => f.path.includes("src/old"))).toBe(false);

    rmSync(oldDir, { recursive: true, force: true });
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectScadFiles, collectManifestFiles, shouldSync, filterScadPaths } from "./sync-scad";

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

// ---------------------------------------------------------------------------
// shouldSync
// ---------------------------------------------------------------------------

describe("shouldSync", () => {
  it("returns true when an explicit --local path is provided (regardless of defaultExists)", () => {
    expect(shouldSync("/some/path", false)).toBe(true);
    expect(shouldSync("/some/path", true)).toBe(true);
  });

  it("returns true when no --local flag but the default checkout exists", () => {
    expect(shouldSync(null, true)).toBe(true);
  });

  it("returns false when no --local flag and the default checkout is absent", () => {
    expect(shouldSync(null, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterScadPaths
// ---------------------------------------------------------------------------

describe("filterScadPaths", () => {
  const sampleTree = [
    "negative-carriers/carrier.scad",
    "negative-carriers/src/common/film-sizes.scad",
    "negative-carriers/src/old/omega-d.scad",
    "negative-carriers/README.md",
    "README.md",
    "some-other-dir/carrier.scad",
    "negative-carriers-extra/carrier.scad", // should NOT match — different dir
  ];

  it("returns .scad files under the subdir, relative to it", () => {
    const result = filterScadPaths(sampleTree, "negative-carriers");
    expect(result).toEqual([
      "carrier.scad",
      "src/common/film-sizes.scad",
      "src/old/omega-d.scad",
    ]);
  });

  it("excludes non-.scad files and files outside the subdir", () => {
    const result = filterScadPaths(sampleTree, "negative-carriers");
    expect(result).not.toContain("README.md");
    expect(result.every((p) => !p.startsWith("some-other-dir"))).toBe(true);
  });

  it("does not match a directory whose name starts with the subdir name (prefix collision)", () => {
    const result = filterScadPaths(sampleTree, "negative-carriers");
    expect(result).not.toContain("negative-carriers-extra/carrier.scad");
  });

  it("tolerates a trailing slash in the subdir argument", () => {
    const result = filterScadPaths(sampleTree, "negative-carriers/");
    expect(result).toContain("carrier.scad");
    expect(result).toContain("src/common/film-sizes.scad");
  });

  it("returns an empty array when the tree has no matching files", () => {
    expect(filterScadPaths(["README.md", "src/main.ts"], "negative-carriers")).toEqual([]);
  });

  it("returns an empty array for an empty tree", () => {
    expect(filterScadPaths([], "negative-carriers")).toEqual([]);
  });
});

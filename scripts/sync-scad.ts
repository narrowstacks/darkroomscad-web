import {
  readdirSync,
  statSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { parseCustomizer } from "../src/lib/params/parse-customizer";

const CARRIER_ROOT_SUBDIR = "negative-carriers"; // location of carrier.scad within DarkroomSCAD

export interface ManifestFile {
  url: string; // public path Next serves, e.g. "/scad/carrier.scad"
  path: string; // absolute WASM FS path, root-rooted, e.g. "/carrier.scad", "/BOSL2/std.scad"
}

// Recursively list files under a public/ subtree as { url, path }. `url` is the served path
// ("/<publicSub>/<rel>"); `path` is the FS path the worker writes to, built by `toFsPath(rel)`.
// `excludeRel` filters by the path relative to the subtree root (forward-slash separated).
export function collectManifestFiles(
  publicDir: string,
  publicSub: string,
  toFsPath: (rel: string) => string,
  excludeRel: (rel: string) => boolean = () => false,
): ManifestFile[] {
  const root = join(publicDir, publicSub);
  if (!existsSync(root)) return [];
  const out: ManifestFile[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const rel = relative(root, full).split("\\").join("/");
        if (excludeRel(rel)) continue;
        out.push({ url: `/${publicSub}/${rel}`, path: toFsPath(rel) });
      }
    }
  }
  walk(root);
  return out;
}

export function collectScadFiles(rootDir: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".scad")) out.push(relative(rootDir, full));
    }
  }
  walk(rootDir);
  return out;
}

function resolveSource(): string {
  // --local <path> overrides the default; otherwise expect a prepared checkout.
  const localFlag = process.argv.indexOf("--local");
  const base =
    localFlag !== -1
      ? process.argv[localFlag + 1]
      : process.env.DARKROOMSCAD_PATH ?? "../DarkroomSCAD";
  const root = join(base, CARRIER_ROOT_SUBDIR);
  if (!existsSync(join(root, "carrier.scad"))) {
    throw new Error(`carrier.scad not found under ${root}. Pass --local <DarkroomSCAD path>.`);
  }
  return root;
}

function main() {
  const sourceRoot = resolveSource();
  const destScad = join(process.cwd(), "public", "scad");
  rmSync(destScad, { recursive: true, force: true });
  mkdirSync(destScad, { recursive: true });

  const files = collectScadFiles(sourceRoot);
  for (const rel of files) {
    const dest = join(destScad, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(sourceRoot, rel), dest);
  }

  const carrierSource = readFileSync(join(sourceRoot, "carrier.scad"), "utf8");
  const schema = parseCustomizer(carrierSource);
  const generatedDir = join(process.cwd(), "generated");
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "param-schema.json"), JSON.stringify(schema, null, 2));

  // Asset manifest the render worker fetches. FS paths are root-rooted to match
  // render.ts / the integration test: scad -> "/<rel>" (strip "scad/"), libraries ->
  // "/<rel>" (strip "libraries/", giving "/BOSL2/..."), fonts -> "/fonts/<rel>".
  // src/old/** is excluded (dead weight the carrier never includes).
  const publicDir = join(process.cwd(), "public");
  const manifestFiles: ManifestFile[] = [
    ...collectManifestFiles(
      publicDir,
      "scad",
      (rel) => `/${rel}`,
      (rel) => rel === "src/old" || rel.startsWith("src/old/"),
    ),
    ...collectManifestFiles(publicDir, "libraries", (rel) => `/${rel}`),
    ...collectManifestFiles(publicDir, "fonts", (rel) => `/fonts/${rel}`),
  ];
  writeFileSync(
    join(publicDir, "scad-manifest.json"),
    JSON.stringify({ files: manifestFiles }, null, 2),
  );

  console.log(
    `Synced ${files.length} .scad files; ${schema.params.length} params parsed; ` +
      `${manifestFiles.length} manifest assets.`,
  );
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("sync-scad.ts")) main();

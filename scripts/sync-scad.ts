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

  console.log(`Synced ${files.length} .scad files; ${schema.params.length} params parsed.`);
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("sync-scad.ts")) main();

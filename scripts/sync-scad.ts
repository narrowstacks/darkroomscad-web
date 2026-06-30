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

export interface ScadSourceConfig {
  repo: string;
  ref: string;
  subdir: string;
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

/**
 * Pure predicate: should we attempt a local sync?
 * - explicit `--local` path provided → always true (caller asserts the path exists)
 * - no flag, default checkout present → true
 * - no flag, default checkout missing → false (skip; leave committed artifacts in place)
 */
export function shouldSync(localFlagPath: string | null, defaultExists: boolean): boolean {
  if (localFlagPath !== null) return true;
  return defaultExists;
}

/**
 * Given the flat path list from the GitHub trees API, return .scad paths
 * that live under `subdir`, relative to that subdir.
 *
 * @example filterScadPaths(["negative-carriers/carrier.scad", "README.md"], "negative-carriers")
 *   // → ["carrier.scad"]
 */
export function filterScadPaths(treePaths: string[], subdir: string): string[] {
  const prefix = subdir.endsWith("/") ? subdir : `${subdir}/`;
  return treePaths
    .filter((p) => p.startsWith(prefix) && p.endsWith(".scad"))
    .map((p) => p.slice(prefix.length));
}

// ---------------------------------------------------------------------------
// Source resolution helpers
// ---------------------------------------------------------------------------

/** Returns the --local flag value, or null if not provided. */
function getLocalFlagPath(): string | null {
  const idx = process.argv.indexOf("--local");
  if (idx !== -1) return process.argv[idx + 1] ?? null;
  return null;
}

/** Returns the effective default DarkroomSCAD base path (from env or convention). */
function defaultBase(): string {
  return process.env.DARKROOMSCAD_PATH ?? "../DarkroomSCAD";
}

function resolveSource(): string | null {
  const localFlag = getLocalFlagPath();
  if (localFlag !== null) {
    // Explicit --local: honour exactly as before (throw if missing so dev notices).
    const root = join(localFlag, CARRIER_ROOT_SUBDIR);
    if (!existsSync(join(root, "carrier.scad"))) {
      throw new Error(`carrier.scad not found under ${root}. Check your --local path.`);
    }
    return root;
  }
  // No --local: check the default checkout.
  const base = defaultBase();
  const root = join(base, CARRIER_ROOT_SUBDIR);
  if (!existsSync(join(root, "carrier.scad"))) {
    return null; // caller handles: log warning + skip
  }
  return root;
}

// ---------------------------------------------------------------------------
// Shared write helpers
// ---------------------------------------------------------------------------

function writeArtifacts(
  destScad: string,
  files: Array<{ rel: string; content: string | Buffer }>,
  publicDir: string,
): void {
  for (const { rel, content } of files) {
    const dest = join(destScad, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }

  const carrierEntry = files.find((f) => f.rel === "carrier.scad");
  if (!carrierEntry) throw new Error("carrier.scad not found in synced files");
  const carrierSource =
    typeof carrierEntry.content === "string"
      ? carrierEntry.content
      : carrierEntry.content.toString("utf8");

  const schema = parseCustomizer(carrierSource);
  const generatedDir = join(process.cwd(), "generated");
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, "param-schema.json"), JSON.stringify(schema, null, 2));

  const manifestFiles: ManifestFile[] = [
    ...collectManifestFiles(
      publicDir,
      "scad",
      (rel) => `/${rel}`,
      (rel) => rel.startsWith("src/old/") || rel.endsWith(".gitkeep"),
    ),
    ...collectManifestFiles(publicDir, "libraries", (rel) => `/${rel}`, (rel) =>
      rel.endsWith(".gitkeep"),
    ),
    ...collectManifestFiles(publicDir, "fonts", (rel) => `/fonts/${rel}`, (rel) =>
      rel.endsWith(".gitkeep"),
    ),
    // Pre-baked base bodies for the fast preview path (carrier-baked.scad imports
    // these). Generated by `npm run gen:base-stls`, served at /base-stls/<name>.stl.
    ...collectManifestFiles(publicDir, "base-stls", (rel) => `/base-stls/${rel}`, (rel) =>
      rel.endsWith(".gitkeep"),
    ),
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

// ---------------------------------------------------------------------------
// Local mode
// ---------------------------------------------------------------------------

function runLocalSync(sourceRoot: string): void {
  const destScad = join(process.cwd(), "public", "scad");
  rmSync(destScad, { recursive: true, force: true });
  mkdirSync(destScad, { recursive: true });

  const rels = collectScadFiles(sourceRoot);
  // Copy files using the filesystem (binary-safe), then re-read for writeArtifacts.
  for (const rel of rels) {
    const dest = join(destScad, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(sourceRoot, rel), dest);
  }

  // Build the file list from the freshly-copied dest (so writeArtifacts reads what's there).
  const files = rels.map((rel) => ({
    rel,
    content: readFileSync(join(destScad, rel)),
  }));

  const publicDir = join(process.cwd(), "public");
  writeArtifacts(destScad, files, publicDir);
}

// ---------------------------------------------------------------------------
// GitHub mode  (--github)
// NOTE: This is a DEV REFRESH TOOL, not part of the prebuild. It overwrites
// public/scad with the pinned ref's carrier. Review the diff before committing.
// ---------------------------------------------------------------------------

async function runGithubSync(): Promise<void> {
  const configPath = join(process.cwd(), "scripts", "scad-source.config.json");
  if (!existsSync(configPath)) {
    throw new Error(`scad-source.config.json not found at ${configPath}`);
  }
  const config: ScadSourceConfig = JSON.parse(readFileSync(configPath, "utf8"));
  const { repo, ref, subdir } = config;

  console.log(`Fetching DarkroomSCAD from GitHub: ${repo}@${ref} (${subdir})`);

  // 1. List all files in the tree at the pinned ref.
  const treesUrl = `https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`;
  const treesRes = await fetch(treesUrl, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!treesRes.ok) {
    throw new Error(`GitHub trees API returned ${treesRes.status} for ${treesUrl}`);
  }
  const treesJson = (await treesRes.json()) as { tree: Array<{ path: string; type: string }> };
  const allPaths = treesJson.tree.filter((e) => e.type === "blob").map((e) => e.path);

  // 2. Filter to .scad files under the subdir.
  const scadRels = filterScadPaths(allPaths, subdir);
  if (scadRels.length === 0) {
    throw new Error(`No .scad files found under ${subdir}/ at ref ${ref}`);
  }
  console.log(`Found ${scadRels.length} .scad files under ${subdir}/`);

  // 3. Fetch each file from raw.githubusercontent.com.
  const files: Array<{ rel: string; content: string }> = [];
  for (const rel of scadRels) {
    const rawUrl = `https://raw.githubusercontent.com/${repo}/${ref}/${subdir}/${rel}`;
    const res = await fetch(rawUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${rawUrl}: HTTP ${res.status}`);
    }
    files.push({ rel, content: await res.text() });
  }

  // 4. Write the files and update schema + manifest.
  const destScad = join(process.cwd(), "public", "scad");
  rmSync(destScad, { recursive: true, force: true });
  mkdirSync(destScad, { recursive: true });

  const publicDir = join(process.cwd(), "public");
  writeArtifacts(destScad, files, publicDir);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const useGithub = process.argv.includes("--github");

  if (useGithub) {
    await runGithubSync();
    return;
  }

  // Local mode: use --local or the default checkout.
  const localFlagPath = getLocalFlagPath();
  const base = localFlagPath !== null ? localFlagPath : defaultBase();
  const defaultCarrierExists = existsSync(join(base, CARRIER_ROOT_SUBDIR, "carrier.scad"));

  if (!shouldSync(localFlagPath, defaultCarrierExists)) {
    console.warn(
      "WARNING: DarkroomSCAD source not found at " +
        join(defaultBase(), CARRIER_ROOT_SUBDIR) +
        ".\n" +
        "Skipping sync — using committed public/scad artifacts for the build.\n" +
        "To refresh from GitHub: npm run sync:scad:github\n" +
        "To sync from a local checkout: npm run sync:scad -- --local <path>",
    );
    process.exit(0);
  }

  const sourceRoot = resolveSource();
  if (sourceRoot === null) {
    // Shouldn't reach here given the shouldSync check above, but be defensive.
    process.exit(0);
  }
  runLocalSync(sourceRoot);
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("sync-scad.ts")) main().catch((err) => {
  console.error(err);
  process.exit(1);
});

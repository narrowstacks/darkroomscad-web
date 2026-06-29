This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy

### Source of record: committed `public/scad`

The carrier SCAD files, parsed parameter schema (`generated/param-schema.json`), and asset manifest (`public/scad-manifest.json`) are committed to the repository. These committed artifacts are the source of record for every build and deploy — Vercel uses them directly without fetching from GitHub at build time.

The `prebuild` script (`tsx scripts/sync-scad.ts`) detects whether the local DarkroomSCAD checkout is present. If it is absent (as on Vercel CI), it logs a warning and exits 0, leaving the committed artifacts in place. The build then proceeds normally.

### Refreshing the carrier from GitHub (dev only)

To update `public/scad/**` from the pinned DarkroomSCAD commit, run:

```bash
npm run sync:scad:github
```

This fetches files from the ref pinned in `scripts/scad-source.config.json`, overwrites `public/scad/`, regenerates the schema and manifest, then exits. Review the diff and commit the changes deliberately — this is the mechanism for bumping the carrier design.

To update the pinned ref, edit `scripts/scad-source.config.json` and set `ref` to the desired commit SHA (never a branch name — use a SHA for reproducible builds):

```json
{ "repo": "narrowstacks/DarkroomSCAD", "ref": "<SHA>", "subdir": "negative-carriers" }
```

### COOP/COEP headers (required for WASM)

The OpenSCAD WASM worker requires cross-origin isolation (`SharedArrayBuffer`). `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all routes. Vercel applies these via Next.js's built-in header support — no additional config needed.

### Static app, no serverless functions

The app is entirely client-side. All rendering is done in the browser via the WASM worker. The 9.6 MB `openscad.wasm` and SCAD assets are served from `public/` as static files. Vercel serves them from its CDN — no serverless functions are required.

### First deploy

```bash
vercel
```

Or import the repository via the [Vercel dashboard](https://vercel.com/new). No environment variables are required. Vercel's detected framework preset for Next.js will work automatically.

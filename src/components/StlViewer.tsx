"use client";
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Bounds, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { parseBinaryStl } from "@/lib/stl/parse-stl";
import { safeGet, safeSet } from "@/lib/storage/local-storage";
import { useTheme } from "./ThemeProvider";

type Projection = "ortho" | "perspective";
const PROJECTION_KEY = "darkroomscad-projection";
const loadProjection = (): Projection => (safeGet(PROJECTION_KEY) === "perspective" ? "perspective" : "ortho");

// Shared top-down framing: overhead, OpenSCAD +Y up, carrier landscape — matches
// the 2D preview. Both cameras start here so the default view is top-down; ortho
// is a true flat projection (no perspective skew), perspective adds depth.
const CAM_POSITION: [number, number, number] = [0, 140, 0];
const CAM_UP: [number, number, number] = [0, 0, -1];

function Model({ stl, color }: { stl: Uint8Array; color: string }) {
  const geometry = useMemo(() => {
    const mesh = parseBinaryStl(stl);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    // computeVertexNormals derives smooth normals for the preview; the parsed face
    // normals aren't set here (they'd just be overwritten).
    g.computeVertexNormals();
    return g;
  }, [stl]);
  // Free the previous geometry's GPU buffers when the STL changes or on unmount —
  // live preview generates a fresh STL on every parameter change.
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />
    </mesh>
  );
}

export function StlViewer({ stl, quality, loading }: {
  stl?: Uint8Array;
  quality: "preview" | "final";
  loading?: boolean;
}) {
  const { viewer } = useTheme();
  // StlViewer only mounts in 3D mode (client-side), so reading the persisted
  // projection in the initializer is safe — it never server-renders.
  const [projection, setProjection] = useState<Projection>(loadProjection);
  const changeProjection = (p: Projection) => { setProjection(p); safeSet(PROJECTION_KEY, p); };

  return (
    <div className="shadow-subtle relative h-full w-full overflow-hidden rounded-2xl"
      style={{ background: viewer.background, border: "1px solid var(--border)" }}>
      <Canvas shadows>
        {/* Conditionally mount the active camera (makeDefault) so projection can be
            switched at runtime; each mounts at the shared top-down framing. */}
        {projection === "ortho"
          ? <OrthographicCamera makeDefault position={CAM_POSITION} up={CAM_UP} zoom={3} near={0.1} far={2000} />
          : <PerspectiveCamera makeDefault position={CAM_POSITION} up={CAM_UP} fov={45} near={0.1} far={2000} />}
        {/* Lower ambient + a grazing key light with a tight, high-res shadow map so
            recesses (etched text, peg/screw holes, the board pocket) self-shadow and
            read with contrast; a soft fill keeps shadows from going fully black. */}
        {/* Raking key light (low elevation) so shallow etched text and hole walls
            cast visible shadows across their floors — reveals surface relief that a
            steep light washes out. Tight high-res shadow map resolves ~1mm features;
            a soft fill keeps the far side from going black. */}
        <ambientLight intensity={0.45} />
        <directionalLight position={[70, 22, 30]} intensity={1.7} castShadow
          shadow-mapSize={[4096, 4096]} shadow-bias={-0.00015}>
          <orthographicCamera attach="shadow-camera" args={[-150, 150, 150, -150, 0.1, 500]} />
        </directionalLight>
        <directionalLight position={[-50, 40, -30]} intensity={0.4} />
        {/* Under-fill so the carrier's bottom face is decently lit when orbited. */}
        <directionalLight position={[-20, -55, 25]} intensity={0.55} />
        <Grid args={[400, 400]} cellSize={10} sectionSize={50}
          cellColor={viewer.grid} sectionColor={viewer.grid} infiniteGrid fadeDistance={500}
          position={[0, -0.01, 0]} />
        {stl && (
          // Re-fit when the projection changes so the new camera frames the model.
          <Bounds key={`bounds-${projection}`} fit clip observe margin={1.2}>
            {/* rotate so OpenSCAD's Z-up reads upright in three's Y-up */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Model stl={stl} color={viewer.model} />
            </group>
          </Bounds>
        )}
        {/* Remount on projection change so OrbitControls rebinds to the new default camera. */}
        <OrbitControls key={`controls-${projection}`} makeDefault enableDamping />
      </Canvas>

      {/* Projection toggle — only while a model is shown (kept clear of the load overlays). */}
      {stl && !loading && (
        <div className="absolute left-3 top-3 inline-flex gap-1 rounded-full p-0.5"
          style={{ background: "rgba(var(--bg-rgb), 0.6)", border: "1px solid var(--border)", backdropFilter: "blur(6px)" }}>
          {([["ortho", "Flat"], ["perspective", "3D"]] as const).map(([value, label]) => {
            const active = projection === value;
            return (
              <button key={value} type="button" aria-pressed={active}
                onClick={() => changeProjection(value)}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2"
                style={active
                  ? { background: "var(--primary)", color: "var(--on-primary)" }
                  : { color: "var(--text-muted)" }}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Cold start: the WASM engine is still downloading/compiling and there is no
          model to show yet. Cover the empty canvas with an informative overlay so the
          ~10s first-load wait reads as progress, not a broken page. */}
      {loading && !stl && (
        <div className="animate-fade-in absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: viewer.background }}>
          <span className="h-9 w-9 rounded-full border-2 animate-spin motion-reduce:animate-none"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} aria-hidden />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Starting the 3D engine…</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Rendering your first preview. The engine (~10&nbsp;MB) downloads once, then loads from cache.
            </p>
          </div>
        </div>
      )}
      {/* No re-render overlay: baked previews complete in ~100ms, so a dark "Rendering…"
          screen would just flash. The model swaps in place; the cold-start overlay above
          still covers the one-time engine download. */}
      {quality === "preview" && stl && !loading && (
        <span className="eyebrow absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: "rgba(var(--bg-rgb), 0.6)", border: "1px solid var(--border)", backdropFilter: "blur(6px)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "var(--primary)" }} aria-hidden />
          Live preview
        </span>
      )}
    </div>
  );
}

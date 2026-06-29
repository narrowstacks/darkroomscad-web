"use client";
import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Bounds } from "@react-three/drei";
import * as THREE from "three";
import { parseBinaryStl } from "@/lib/stl/parse-stl";
import { useTheme } from "./ThemeProvider";

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
    <mesh geometry={geometry} castShadow>
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
  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden"
      style={{ background: viewer.background, border: "1px solid var(--border)" }}>
      <Canvas camera={{ position: [80, 80, 80], fov: 45 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 30]} intensity={1.1} castShadow />
        <Grid args={[400, 400]} cellSize={10} sectionSize={50}
          cellColor={viewer.grid} sectionColor={"#454545"} infiniteGrid fadeDistance={500}
          position={[0, -0.01, 0]} />
        {stl && (
          <Bounds fit clip observe margin={1.2}>
            {/* rotate so OpenSCAD's Z-up reads upright in three's Y-up */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Model stl={stl} color={viewer.model} />
            </group>
          </Bounds>
        )}
        <OrbitControls makeDefault enableDamping />
      </Canvas>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm"
          style={{ color: "var(--text-muted)", background: "rgba(0,0,0,0.35)" }}>
          rendering…
        </div>
      )}
      {quality === "preview" && stl && !loading && (
        <span className="absolute top-2 right-2 rounded px-2 py-0.5 text-xs"
          style={{ background: "var(--surface-muted)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
          preview quality
        </span>
      )}
    </div>
  );
}

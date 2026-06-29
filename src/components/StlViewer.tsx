"use client";
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Bounds } from "@react-three/drei";
import * as THREE from "three";
import { parseBinaryStl } from "@/lib/stl/parse-stl";

function Model({ stl }: { stl: Uint8Array }) {
  const geometry = useMemo(() => {
    const mesh = parseBinaryStl(stl);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    g.computeVertexNormals();
    return g;
  }, [stl]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={"#9a9a9a"} metalness={0.1} roughness={0.8} />
    </mesh>
  );
}

export function StlViewer({ stl, quality, loading }: {
  stl?: Uint8Array;
  quality: "preview" | "final";
  loading?: boolean;
}) {
  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <Canvas camera={{ position: [80, 80, 80], fov: 45 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 30]} intensity={1.1} castShadow />
        <Grid args={[400, 400]} cellSize={10} sectionSize={50}
          cellColor={"#353535"} sectionColor={"#454545"} infiniteGrid fadeDistance={500}
          position={[0, -0.01, 0]} />
        {stl && (
          <Bounds fit clip observe margin={1.2}>
            {/* rotate so OpenSCAD's Z-up reads upright in three's Y-up */}
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <Model stl={stl} />
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

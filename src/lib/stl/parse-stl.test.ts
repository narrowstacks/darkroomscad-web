import { describe, it, expect } from "vitest";
import { parseBinaryStl } from "./parse-stl";

// Build a minimal binary STL: 80-byte header, uint32 triangle count, then per triangle
// 12 floats (normal + 3 verts) + uint16 attr. One triangle.
function makeOneTriangleStl(): Uint8Array {
  const triCount = 1;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, triCount, true);
  const floats = [0, 0, 1, /*n*/ 0, 0, 0, /*v1*/ 1, 0, 0, /*v2*/ 0, 1, 0 /*v3*/];
  let off = 84;
  for (const f of floats) { dv.setFloat32(off, f, true); off += 4; }
  // attr byte count uint16 left as 0
  return new Uint8Array(buf);
}

describe("parseBinaryStl", () => {
  it("parses triangle count, positions, and bounding box", () => {
    const mesh = parseBinaryStl(makeOneTriangleStl());
    expect(mesh.triangleCount).toBe(1);
    expect(mesh.positions.length).toBe(9); // 3 verts * 3 coords
    expect(Array.from(mesh.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(mesh.bbox.min).toEqual([0, 0, 0]);
    expect(mesh.bbox.max).toEqual([1, 1, 0]);
  });

  it("throws on a too-short buffer", () => {
    expect(() => parseBinaryStl(new Uint8Array(10))).toThrow();
  });

  it("throws when the triangle section is truncated", () => {
    // Header + count=5, but only room for ~0 triangles of payload.
    const buf = new ArrayBuffer(84 + 10);
    new DataView(buf).setUint32(80, 5, true); // claims 5 triangles (needs 84 + 5*50 bytes)
    expect(() => parseBinaryStl(new Uint8Array(buf))).toThrow();
  });
});

export interface StlMesh {
  positions: Float32Array;
  normals: Float32Array;
  triangleCount: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
}

export function parseBinaryStl(data: Uint8Array): StlMesh {
  if (data.byteLength < 84) throw new Error("STL too short to contain a header");
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const triangleCount = dv.getUint32(80, true);
  const expected = 84 + triangleCount * 50;
  if (data.byteLength < expected) throw new Error(`STL truncated: expected ${expected} bytes`);

  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  let off = 84;
  for (let t = 0; t < triangleCount; t++) {
    const nx = dv.getFloat32(off, true), ny = dv.getFloat32(off + 4, true), nz = dv.getFloat32(off + 8, true);
    off += 12;
    for (let v = 0; v < 3; v++) {
      const x = dv.getFloat32(off, true), y = dv.getFloat32(off + 4, true), z = dv.getFloat32(off + 8, true);
      off += 12;
      const i = t * 9 + v * 3;
      positions[i] = x; positions[i + 1] = y; positions[i + 2] = z;
      normals[i] = nx; normals[i + 1] = ny; normals[i + 2] = nz;
      if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
    }
    off += 2; // attribute byte count
  }
  return { positions, normals, triangleCount, bbox: { min, max } };
}

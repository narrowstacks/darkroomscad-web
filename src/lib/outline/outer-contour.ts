// Extract the outer contour from an OpenSCAD-exported SVG.
// A projection() SVG can contain multiple subpaths: one outer body contour plus
// inner "hole" contours (through-holes show as holes in the projection). We keep
// only the subpath with the largest bounding-box area (the body) and drop the rest.

function subpaths(d: string): string[] {
  // Split before each moveto command, keep the command.
  return d.split(/(?=[Mm])/).map((s) => s.trim()).filter(Boolean);
}

function coords(sub: string): { xs: number[]; ys: number[] } {
  const nums = (sub.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const xs: number[] = [], ys: number[] = [];
  // Assumes M/L/Z path data only (OpenSCAD projection() emits polygon outlines) —
  // stride 2 is correct here. NOT valid for arc (A) / bezier (C) commands.
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
  return { xs, ys };
}

function bboxArea(sub: string): number {
  const { xs, ys } = coords(sub);
  if (xs.length === 0) return 0;
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

export function extractOuterContour(svg: string): { d: string; viewBox: string } {
  // Assumes a single <path> element (OpenSCAD projection() emits one path with all
  // contours as subpaths). Multi-path SVGs would only have their first path read.
  const dMatch = svg.match(/\bd\s*=\s*"([^"]+)"/);
  if (!dMatch) throw new Error("no path data found in SVG");
  const subs = subpaths(dMatch[1]);
  if (subs.length === 0) throw new Error("no subpaths in path data");
  const outer = subs.reduce((a, b) => (bboxArea(b) >= bboxArea(a) ? b : a));
  const { xs, ys } = coords(outer);
  const minX = Math.floor(Math.min(...xs)), minY = Math.floor(Math.min(...ys));
  const w = Math.ceil(Math.max(...xs)) - minX, h = Math.ceil(Math.max(...ys)) - minY;
  return { d: outer, viewBox: `${minX} ${minY} ${w} ${h}` };
}

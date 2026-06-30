"use client";
import { useMemo, useState, useEffect } from "react";
import type { FormValue } from "@/lib/form/types";
import { parseConfig } from "@/lib/twod/types";
import { buildScene } from "@/lib/twod/geometry";
import { measureTextWidthMm, estimateTextWidthMm } from "@/lib/twod/measure-text";
import { CARRIER_OUTLINES } from "@/lib/outline/outlines";
import { BOARD_OUTLINES } from "@/lib/outline/board-outlines";
import { useTheme } from "./ThemeProvider";

interface Box { minX: number; minY: number; w: number; h: number; }

function parseVB(vb: string): Box {
  const [minX, minY, w, h] = vb.split(/\s+/).map(Number);
  return { minX, minY, w, h };
}

function unionBox(a: Box, b: Box): Box {
  const minX = Math.min(a.minX, b.minX), minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.minX + a.w, b.minX + b.w), maxY = Math.max(a.minY + a.h, b.minY + b.h);
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

// Chamfered-rectangle path in raw SCAD coords (centered at origin). Lives inside
// the scale(1 -1) group so the group applies the y-flip; emit coords as-is.
function chamferRectInScad(w: number, h: number, c: number): string {
  const hw = w / 2, hh = h / 2, k = Math.min(c, hw, hh);
  const p: [number, number][] = [
    [-hw + k, -hh], [hw - k, -hh], [hw, -hh + k], [hw, hh - k],
    [hw - k, hh], [-hw + k, hh], [-hw, hh - k], [-hw, -hh + k],
  ];
  return "M " + p.map(([x, y]) => `${x},${y}`).join(" L ") + " z";
}

export function CarrierView2D({ values }: { values: Record<string, FormValue> }) {
  const { viewer } = useTheme();
  const config = useMemo(() => parseConfig(values), [values]);

  const [measureReady, setMeasureReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setMeasureReady(false);
    const finish = () => { if (!cancelled) setMeasureReady(true); };
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.load(`${config.fontSize}px "${config.fontFace}"`).then(finish, finish);
    } else {
      finish();
    }
    return () => { cancelled = true; };
  }, [config.fontFace, config.fontSize]);

  const scene = useMemo(
    () => buildScene(config, measureReady ? measureTextWidthMm : estimateTextWidthMm),
    [config, measureReady],
  );

  const body = (config.topOrBottom === "top" ? CARRIER_OUTLINES[`${config.carrierType}:top`] : undefined)
    ?? CARRIER_OUTLINES[config.carrierType];
  const board = scene.boardKey ? BOARD_OUTLINES[scene.boardKey] : undefined;

  // Padded union viewBox in the outline's native export coordinates (the body and
  // board paths are rendered raw in that space; features/text are mapped into it).
  const view = useMemo(() => {
    if (!body) return { minX: -100, minY: -100, w: 200, h: 200 };
    let b = parseVB(body.viewBox);
    if (board) b = unionBox(b, parseVB(board.viewBox));
    const pad = 8;
    return { minX: b.minX - pad, minY: b.minY - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  }, [body, board]);

  // Cut-throughs read as the viewer background; etches as muted ink.
  const cut = viewer.background;
  return (
    <div className="shadow-subtle relative h-full w-full overflow-hidden rounded-2xl"
      style={{ background: viewer.background, border: "1px solid var(--border)" }}>
      <svg viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
        className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Body: raw outline from the OpenSCAD SVG export, which already maps the
            model's +Y to screen-up. Drawn untransformed so it shares orientation
            with the 3D view. */}
        {body && <path data-layer="body" d={body.d} fill={viewer.model} />}
        {/* Cut + additive features are computed in trueSCAD coords; scale(1,-1)
            maps them into the export space (model +Y → screen-up) so they align
            with the body and match the 3D layout. */}
        <g transform="scale(1 -1)">
          {/* Film opening (cut through). */}
          <path data-layer="opening" d={chamferRectInScad(scene.opening.w, scene.opening.h, scene.opening.chamfer)}
            fill={cut} stroke="var(--border)" strokeWidth={0.4} />
          {/* Pegs (additive) and holes (cut). */}
          {scene.pegs.map((p, i) => (
            <circle key={`peg-${i}`} data-layer="peg" cx={p.cx} cy={p.cy} r={p.r}
              fill={p.kind === "peg" ? "var(--text-muted)" : cut}
              stroke="var(--border)" strokeWidth={0.4} />
          ))}
          {/* Alignment-screw footprint holes. */}
          {scene.screwHoles.map((s, i) => (
            <circle key={`screw-${i}`} data-layer="screw" cx={s.cx} cy={s.cy} r={s.r}
              fill={cut} stroke="var(--border)" strokeWidth={0.4} />
          ))}
          {/* Directional arrow (etch). */}
          {scene.arrow && (
            <polygon data-layer="arrow"
              points={scene.arrow.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="var(--text-muted)" />
          )}
        </g>
        {/* Board overlay: dashed ghost of the stacked alignment board (raw export
            coords like the body), on top of the carrier. */}
        {board && (
          <g opacity={0.9}>
            <path d={board.d} fillRule="evenodd" fill="none"
              stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="4 3" />
          </g>
        )}
        {/* Text in an unscaled group so glyphs are not mirrored. */}
        <g>
          {scene.texts.map((t, i) => (
            <text key={`text-${i}`}
              transform={`translate(${t.cx} ${-t.cy}) rotate(${-t.rotationDeg})`}
              textAnchor="middle" dominantBaseline="central"
              fontFamily={`"${t.fontFace}"`} fontSize={t.fontSize} fill="var(--text)">
              {t.value}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

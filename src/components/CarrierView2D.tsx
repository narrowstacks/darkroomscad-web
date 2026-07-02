"use client";
import { useMemo, useState, useEffect } from "react";
import type { FormValue } from "@/lib/form/types";
import { parseConfig, type DimensionAnnotation } from "@/lib/twod/types";
import { buildScene, effectiveOrientation } from "@/lib/twod/geometry";
import { buildFilmOverlay, type CustomFilmSpec } from "@/lib/twod/film-overlay";
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

// Two short (2mm) perpendicular ticks at each end of a dimension line, in raw
// SCAD coords (lives inside the scale(1 -1) group alongside the line itself).
function dimensionTicks(from: [number, number], to: [number, number], axis: "x" | "y"): string {
  const tick = 2; // mm, half-length of each end tick
  const seg = (cx: number, cy: number) =>
    axis === "x" ? `M ${cx},${cy - tick} L ${cx},${cy + tick}` : `M ${cx - tick},${cy} L ${cx + tick},${cy}`;
  return `${seg(from[0], from[1])} ${seg(to[0], to[1])}`;
}

// Midpoint of a dimension line, nudged 2mm along the perpendicular so the
// label doesn't sit on top of the line (same direction the callout already
// stands off the measured extent — i.e. further from center). In raw SCAD
// coords; the caller negates y when placing it into the unscaled text group.
function dimensionLabelPos(d: DimensionAnnotation): [number, number] {
  const nudge = 2; // mm
  if (d.axis === "x") {
    const fixedY = d.from[1]; // both ends share y
    const sign = fixedY < 0 ? -1 : 1;
    return [(d.from[0] + d.to[0]) / 2, fixedY + sign * nudge];
  }
  const fixedX = d.from[0]; // both ends share x
  const sign = fixedX < 0 ? -1 : 1;
  return [fixedX + sign * nudge, (d.from[1] + d.to[1]) / 2];
}

export function CarrierView2D({ values, showDimensions = false, showFilm = false, customFilm }: { values: Record<string, FormValue>; showDimensions?: boolean; showFilm?: boolean; customFilm?: CustomFilmSpec }) {
  const { theme, viewer } = useTheme();
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

  // Film overlay in trueSCAD coords. travelExtent is the half-length the strip
  // must cover along its travel axis to fill the viewport; derive it from the
  // padded view box (X in export coords == SCAD x; SCAD y == -exportY, so the
  // magnitude of the Y span is symmetric either way).
  const filmOverlay = useMemo(() => {
    if (!showFilm) return null;
    const travelExtent = effectiveOrientation(config) === "vertical"
      ? Math.max(Math.abs(view.minX), Math.abs(view.minX + view.w))
      : Math.max(Math.abs(view.minY), Math.abs(view.minY + view.h));
    return buildFilmOverlay(config, travelExtent, customFilm);
  }, [showFilm, config, view, customFilm]);

  // Cut-throughs read as the viewer background; etches as muted ink.
  const cut = viewer.background;
  // High contrast draws the carrier as line art: an unfilled silhouette with a
  // white perimeter stroke (the other themes keep the solid grey body).
  const outlineOnly = theme === "high-contrast";
  return (
    <div className="shadow-subtle relative h-full w-full overflow-hidden rounded-2xl"
      style={{ background: viewer.background, border: "1px solid var(--border)" }}>
      <svg viewBox={`${view.minX} ${view.minY} ${view.w} ${view.h}`}
        className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Body: raw outline from the OpenSCAD SVG export, which already maps the
            model's +Y to screen-up. Drawn untransformed so it shares orientation
            with the 3D view. */}
        {body && (
          <path data-layer="body" d={body.d}
            fill={outlineOnly ? "none" : viewer.model}
            stroke={outlineOnly ? "var(--border)" : "none"}
            strokeWidth={outlineOnly ? 1 : undefined} />
        )}
        {/* Cut + additive features are computed in trueSCAD coords; scale(1,-1)
            maps them into the export space (model +Y → screen-up) so they align
            with the body and match the 3D layout. */}
        <g transform="scale(1 -1)">
          {/* Film opening (cut through). */}
          <path data-layer="opening" d={chamferRectInScad(scene.opening.w, scene.opening.h, scene.opening.chamfer)}
            fill={cut} stroke="var(--border)" strokeWidth={0.4} />
          {/* Pegs (additive — saturated so they read on the grey body in every
              theme) and holes (cut through → viewer background). */}
          {scene.pegs.map((p, i) => (
            <circle key={`peg-${i}`} data-layer="peg" cx={p.cx} cy={p.cy} r={p.r}
              fill={p.kind === "peg" ? "var(--primary)" : cut}
              stroke="var(--border)" strokeWidth={0.4} />
          ))}
          {/* Alignment-screw footprint holes. */}
          {scene.screwHoles.map((s, i) => (
            <circle key={`screw-${i}`} data-layer="screw" cx={s.cx} cy={s.cy} r={s.r}
              fill={cut} stroke="var(--border)" strokeWidth={0.4} />
          ))}
          {/* Film-format overlay: the real film for the selected format,
              registered so one frame is centered on the opening. Drawn ON TOP of
              the opening/pegs so the film image area is always visible at its
              exact size — the opening's cut-through fill must never obscure it
              (which would just read as a background-colored box over the film). */}
          {filmOverlay?.base && (
            <g data-layer="film">
              {/* Film body (the physical strip/roll extent) — translucent so the
                  carrier body + opening still read through it. */}
              <rect data-layer="film" x={-filmOverlay.base.w / 2} y={-filmOverlay.base.h / 2}
                width={filmOverlay.base.w} height={filmOverlay.base.h}
                fill="var(--secondary)" fillOpacity={0.12}
                stroke="var(--secondary)" strokeOpacity={0.5} strokeWidth={0.4} />
              {/* Sprocket perforations (punched → viewer background). */}
              {filmOverlay.sprockets.map((s, i) => (
                <rect key={`sprocket-${i}`} data-layer="film"
                  x={s.cx - s.w / 2} y={s.cy - s.h / 2} width={s.w} height={s.h} rx={0.4}
                  fill={cut} stroke="var(--secondary)" strokeOpacity={0.5} strokeWidth={0.2} />
              ))}
              {/* Image-area frames — the actual exposed image at exact size. A
                  filled tint (over the opening's cut fill) plus a crisp border so
                  the frame reads clearly even where it lies inside the opening. */}
              {filmOverlay.frames.map((f, i) => (
                <rect key={`frame-${i}`} data-layer="film"
                  x={f.cx - f.w / 2} y={f.cy - f.h / 2} width={f.w} height={f.h}
                  fill="var(--secondary)" fillOpacity={0.18}
                  stroke="var(--secondary)" strokeOpacity={0.9} strokeWidth={0.4} />
              ))}
            </g>
          )}
          {/* Directional arrow (etch). */}
          {scene.arrow && (
            <polygon data-layer="arrow"
              points={scene.arrow.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="var(--text-muted)" />
          )}
          {/* Dimension callouts (opening size, peg spacing) — annotation only,
              off by default. Lines live here (raw SCAD coords, flipped by the
              group); labels are rendered separately in the unscaled text group
              below to avoid mirrored glyphs. */}
          {showDimensions && scene.dimensions.map((d, i) => (
            <g key={`dim-${i}`}>
              {/* Background-colored halo underlay so the callout reads over the grey body. */}
              <line data-layer="dimension" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]}
                stroke={viewer.background} strokeWidth={1.1} strokeLinecap="round" />
              <path data-layer="dimension" d={dimensionTicks(d.from, d.to, d.axis)}
                stroke={viewer.background} strokeWidth={1.1} strokeLinecap="round" fill="none" />
              <line data-layer="dimension" x1={d.from[0]} y1={d.from[1]} x2={d.to[0]} y2={d.to[1]}
                stroke="var(--text)" strokeWidth={0.3} />
              <path data-layer="dimension" d={dimensionTicks(d.from, d.to, d.axis)}
                stroke="var(--text)" strokeWidth={0.3} fill="none" />
            </g>
          ))}
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
          {/* Dimension labels — same unscaled-group + y-negation trick as the
              etch texts above, so they aren't mirrored by the scale(1 -1)
              group the lines live in. */}
          {showDimensions && scene.dimensions.map((d, i) => {
            const [lx, ly] = dimensionLabelPos(d);
            return (
              <text key={`dim-label-${i}`} data-layer="dimension"
                transform={`translate(${lx} ${-ly})${d.axis === "y" ? " rotate(-90)" : ""}`}
                textAnchor="middle" dominantBaseline="central"
                fontSize={4} fill="var(--text)"
                stroke={viewer.background} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round"
                paintOrder="stroke">
                {d.label}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

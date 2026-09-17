import type { FormValue } from "@/lib/form/types";

export interface TwoDConfig {
  carrierType: string;
  orientation: "vertical" | "horizontal";
  topOrBottom: "top" | "bottom";
  filmFormat: string;
  /** Consecutive frames the opening spans (Frame_Count). Only meaningful for
   *  formats with a frame pitch — see effectiveFrameCount. */
  frameCount: number;
  customFilmWidth: number;
  customFilmHeight: number;
  customOpeningWidth: number;
  customOpeningHeight: number;
  pegStyle: "printed" | "heat_set";
  pegGap: number;
  adjustFilmWidth: number;
  adjustFilmHeight: number;
  alignmentBoard: boolean;
  alignmentBoardType: string;
  enableOwnerEtch: boolean;
  ownerName: string;
  enableTypeEtch: boolean;
  typeNameSource: string; // "Carrier Type" | "Custom"
  customTypeName: string;
  fontFace: string;
  fontSize: number;
  ownerTextOffset: [number, number];
  typeTextOffset: [number, number];
  /** Glass-plate carrier (omega-d-glass) pocket + finger-notch params. */
  glass: GlassConfig;
}

export interface GlassConfig {
  plateWidth: number;      // across the carrier (X, short edge)
  plateLength: number;     // along the carrier width (Y, long edge)
  plateThickness: number;
  sidePlay: number;        // per side, plate → pocket wall
  depthPlay: number;
  notchDiameter: number;   // 0 = none
  notchCorner: string;     // handle-lower | handle-upper | far-lower | far-upper | none
  notchFloor: number;      // material left under the notch; 0 cuts through
  notchReach: number;      // how far the notch reaches under the plate edge
}

/** A chamfered rectangle centered at the origin (SCAD mm). */
export interface OpeningShape { w: number; h: number; chamfer: number; }
/** A peg (additive) or hole (cut-through) circle at (cx, cy) with radius r. */
export interface PegShape { cx: number; cy: number; r: number; kind: "peg" | "hole"; }
export interface CircleShape { cx: number; cy: number; r: number; }
/** A blind recess in the top face (glass-plate pocket / finger notch): a
 *  rounded rectangle or a circle, `through` when it's cut all the way. */
export type RecessShape =
  | { kind: "rect"; cx: number; cy: number; w: number; h: number; r: number; through: boolean }
  | { kind: "circle"; cx: number; cy: number; r: number; through: boolean };
/** Etched arrow as an explicit polygon in SCAD coords. */
export interface ArrowShape { points: [number, number][]; }
export interface TextPlacement {
  value: string; cx: number; cy: number; rotationDeg: number;
  fontFace: string; fontSize: number;
}

/** A linear measurement callout in SCAD mm coords: a line from `from` to `to`
 *  with a centered label. `axis` hints label orientation for the renderer. */
export interface DimensionAnnotation {
  from: [number, number];
  to: [number, number];
  label: string;           // e.g. "36.0 mm"
  axis: "x" | "y";
}

export interface Scene {
  opening: OpeningShape;
  pegs: PegShape[];
  screwHoles: CircleShape[];
  /** Blind recesses (glass-plate pocket, finger notch); empty for film carriers. */
  recesses: RecessShape[];
  arrow: ArrowShape | null;
  texts: TextPlacement[];
  /** Board outline key into BOARD_OUTLINES, or null when no overlay. */
  boardKey: string | null;
  dimensions: DimensionAnnotation[];
}

const str = (v: FormValue | undefined, d: string) => (v == null ? d : String(v));
const num = (v: FormValue | undefined, d: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v: FormValue | undefined, d: boolean) => (typeof v === "boolean" ? v : d);

export function parseConfig(v: Record<string, FormValue>): TwoDConfig {
  return {
    carrierType: str(v.Carrier_Type, "omega-d"),
    orientation: str(v.Orientation, "vertical") === "horizontal" ? "horizontal" : "vertical",
    topOrBottom: str(v.Top_or_Bottom, "bottom") === "top" ? "top" : "bottom",
    filmFormat: str(v.Film_Format, "35mm"),
    frameCount: num(v.Frame_Count, 1),
    customFilmWidth: num(v.Custom_Film_Width, 37),
    customFilmHeight: num(v.Custom_Film_Height, 37),
    customOpeningWidth: num(v.Custom_Opening_Width, 24),
    customOpeningHeight: num(v.Custom_Opening_Height, 36),
    pegStyle: str(v.Printed_or_Heat_Set_Pegs, "heat_set") === "printed" ? "printed" : "heat_set",
    pegGap: num(v.Peg_Gap, 0),
    adjustFilmWidth: num(v.Adjust_Film_Width, 0),
    adjustFilmHeight: num(v.Adjust_Film_Height, 0),
    alignmentBoard: bool(v.Alignment_Board, false),
    alignmentBoardType: str(v.Alignment_Board_Type, "omega"),
    enableOwnerEtch: bool(v.Enable_Owner_Name_Etch, false),
    ownerName: str(v.Owner_Name, ""),
    enableTypeEtch: bool(v.Enable_Type_Name_Etch, false),
    typeNameSource: str(v.Type_Name, "Carrier Type"),
    customTypeName: str(v.Custom_Type_Name, ""),
    fontFace: str(v.Fontface, "Lucida Console"),
    fontSize: num(v.Font_Size, 10),
    ownerTextOffset: [num(v.Owner_Text_X_Offset, 0), num(v.Owner_Text_Y_Offset, 0)],
    typeTextOffset: [num(v.Type_Text_X_Offset, 0), num(v.Type_Text_Y_Offset, 0)],
    // Defaults mirror the carrier.scad customizer values.
    glass: {
      plateWidth: num(v.Glass_Plate_Width, 101),
      plateLength: num(v.Glass_Plate_Length, 126),
      plateThickness: num(v.Glass_Plate_Thickness, 2),
      sidePlay: num(v.Glass_Plate_Side_Play, 0.5),
      depthPlay: num(v.Glass_Plate_Depth_Play, 0.2),
      notchDiameter: num(v.Glass_Notch_Diameter, 16),
      notchCorner: str(v.Glass_Notch_Corner, "handle-lower"),
      notchFloor: num(v.Glass_Notch_Floor, 0.6),
      notchReach: num(v.Glass_Notch_Reach, 2.5),
    },
  };
}

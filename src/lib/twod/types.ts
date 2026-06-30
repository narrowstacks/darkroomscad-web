import type { FormValue } from "@/lib/form/types";

export interface TwoDConfig {
  carrierType: string;
  orientation: "vertical" | "horizontal";
  topOrBottom: "top" | "bottom";
  filmFormat: string;
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
}

/** A chamfered rectangle centered at the origin (SCAD mm). */
export interface OpeningShape { w: number; h: number; chamfer: number; }
/** A peg (additive) or hole (cut-through) circle at (cx, cy) with radius r. */
export interface PegShape { cx: number; cy: number; r: number; kind: "peg" | "hole"; }
export interface CircleShape { cx: number; cy: number; r: number; }
/** Etched arrow as an explicit polygon in SCAD coords. */
export interface ArrowShape { points: [number, number][]; }
export interface TextPlacement {
  value: string; cx: number; cy: number; rotationDeg: number;
  fontFace: string; fontSize: number;
}

export interface Scene {
  opening: OpeningShape;
  pegs: PegShape[];
  screwHoles: CircleShape[];
  arrow: ArrowShape | null;
  texts: TextPlacement[];
  /** Board outline key into BOARD_OUTLINES, or null when no overlay. */
  boardKey: string | null;
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
  };
}

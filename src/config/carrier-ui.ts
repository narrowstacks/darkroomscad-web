import type { GroupConfig, FormValue } from "../lib/form/types";
import { BOARD_CARRIERS, SINGLE_PIECE_CARRIERS, FILM_PEG_CARRIERS, screwOnBoardType } from "./carriers";
import { filmFramePitch } from "../lib/twod/film-data";

const isCustomFormat = (v: Record<string, FormValue>) => v.Film_Format === "custom";
const isGlassCarrier = (v: Record<string, FormValue>) => v.Carrier_Type === "omega-d-glass";
// Single-piece carriers have no top half: Top/Bottom and flip are locked
// (carrier.scad forces bottom / no flip; use-carrier-form pins the values).
const isSinglePiece = (v: Record<string, FormValue>) => SINGLE_PIECE_CARRIERS.has(String(v.Carrier_Type));
const hasFilmPegs = (v: Record<string, FormValue>) => FILM_PEG_CARRIERS.has(String(v.Carrier_Type));
// A screw-on board is never fused and always the carrier's own type: both
// board controls are locked (pinned to off / that type).
const hasScrewOnBoard = (v: Record<string, FormValue>) => screwOnBoardType(String(v.Carrier_Type)) != null;

// Frame count only means something for formats with a frame pitch (not 4x5
// sheets or custom openings — the SCAD ignores it there too).
const hasFramePitch = (v: Record<string, FormValue>) => filmFramePitch(String(v.Film_Format)) > 0;

// Carriers that have an alignment board (test frames don't).
const isBoardCarrier = (v: Record<string, FormValue>) => BOARD_CARRIERS.has(String(v.Carrier_Type));

export const CARRIER_UI: GroupConfig[] = [
  {
    title: "Carrier",
    fields: [
      { param: "Carrier_Type", label: "Enlarger", control: "cards", optionVisual: "carrier-outline",
        help: "Which enlarger this carrier fits.",
        optionLabels: {
          "omega-d": "Omega D Series",
          "omega-d-glass": "Omega D — 4×5 Glass Plate",
          "lpl-saunders-45xx": "LPL-Saunders 45XX Series",
          "beseler-23c": "Beseler 23C Series",
          "beseler-45": "Beseler 45 Series",
          "frameAndPegTest": "Frame Size Test Print",
        },
        // Special-purpose carriers get their own grid under the enlargers.
        optionSections: [{ title: "Special", values: ["omega-d-glass"] }] },
      // Rendered directly under the film-format picker (see CarrierForm), not
      // in field order.
      { param: "Frame_Count", label: "Frames", control: "segmented",
        help: "Consecutive frames the opening spans, printed side by side in one exposure. Check the preview for fit.",
        visibleWhen: hasFramePitch },
      { param: "Orientation", label: "Orientation", control: "segmented",
        help: "Locked for 4×5 — the sheet's orientation is fixed.",
        optionLabels: { "vertical": "Vertical", "horizontal": "Horizontal" },
        // 4x5's orientation is forced by the SCAD (get_effective_orientation),
        // so the toggle is locked; use-carrier-form pins the value to match.
        optionDisabledWhen: (_opt, v) => v.Film_Format === "4x5" },
      { param: "Top_or_Bottom", label: "Part", control: "segmented",
        help: (v) => isSinglePiece(v)
          ? "Locked — the glass-plate carrier is a single piece; the pocket does the clamping."
          : "A full carrier needs both top and bottom printed.",
        optionLabels: { "top": "Top", "bottom": "Bottom" },
        optionDisabledWhen: (_opt, v) => isSinglePiece(v) },
    ],
  },
  {
    // omega-d-glass only: one 4mm piece with a pocket on top that locates a 4x5
    // glass plate (no film pegs); the Omega board is screwed on underneath and
    // exported separately.
    title: "Glass plate",
    fields: [
      { param: "Glass_Plate_Width", label: "Plate width (short edge)", control: "slider",
        min: 50, max: 130, step: 0.5, unit: "mm", visibleWhen: isGlassCarrier },
      { param: "Glass_Plate_Length", label: "Plate length (long edge)", control: "slider",
        min: 50, max: 140, step: 0.5, unit: "mm", visibleWhen: isGlassCarrier },
      { param: "Glass_Plate_Thickness", label: "Plate thickness", control: "slider",
        min: 1, max: 3, step: 0.1, unit: "mm", visibleWhen: isGlassCarrier },
      { param: "Glass_Notch_Corner", label: "Finger notch", control: "segmented",
        help: "A round notch beside one pocket corner, reaching under the plate so it can be lifted out. \"Handle\" corners are on the handle side.",
        optionLabels: {
          "handle-lower": "Handle, lower", "handle-upper": "Handle, upper",
          "far-lower": "Far, lower", "far-upper": "Far, upper", "none": "None",
        },
        visibleWhen: isGlassCarrier },
      { param: "Glass_Notch_Diameter", label: "Notch diameter", control: "slider",
        min: 8, max: 30, step: 1, unit: "mm",
        visibleWhen: (v) => isGlassCarrier(v) && v.Glass_Notch_Corner !== "none" },
    ],
  },
  {
    title: "Custom size",
    fields: [
      { param: "Custom_Film_Width", label: "Film width", control: "slider",
        min: 20, max: 130, step: 1, unit: "mm", visibleWhen: isCustomFormat },
      { param: "Custom_Film_Height", label: "Film height", control: "slider",
        min: 20, max: 130, step: 1, unit: "mm", visibleWhen: isCustomFormat },
      { param: "Custom_Opening_Width", label: "Opening width", control: "slider",
        min: 10, max: 125, step: 1, unit: "mm", visibleWhen: isCustomFormat },
      { param: "Custom_Opening_Height", label: "Opening height", control: "slider",
        min: 10, max: 125, step: 1, unit: "mm", visibleWhen: isCustomFormat },
    ],
  },
  {
    title: "Text",
    fields: [
      { param: "Enable_Owner_Name_Etch", label: "Etch a name", control: "switch" },
      { param: "Owner_Name", label: "Name", control: "text",
        visibleWhen: (v) => v.Enable_Owner_Name_Etch === true },
      { param: "Enable_Type_Name_Etch", label: "Etch the carrier type", control: "switch" },
      { param: "Type_Name", label: "Type label", control: "segmented",
        visibleWhen: (v) => v.Enable_Type_Name_Etch === true },
      { param: "Custom_Type_Name", label: "Custom label", control: "text",
        visibleWhen: (v) => v.Enable_Type_Name_Etch === true && v.Type_Name === "Custom" },
      { param: "Fontface", label: "Font", control: "select", optionsFrom: "fonts" },
      { param: "Font_Size", label: "Font size", control: "slider", min: 4, max: 40, step: 0.5 },
      { param: "Text_As_Separate_Parts", label: "Separate text parts (multi-material)", control: "switch" },
      { param: "Layer_Height_mm", label: "Layer height", control: "slider",
        min: 0.1, max: 0.5, step: 0.01, unit: "mm",
        visibleWhen: (v) => v.Text_As_Separate_Parts === true },
      { param: "Text_Layer_Multiple", label: "Text layers", control: "slider",
        min: 1, max: 6, step: 1,
        visibleWhen: (v) => v.Text_As_Separate_Parts === true },
    ],
  },
  {
    title: "Options",
    fields: [
      { param: "Alignment_Board", label: "Attach alignment board", control: "switch",
        help: (v) => hasScrewOnBoard(v)
          ? "Locked off — this carrier's board is screwed on from below and exported as its own STL (with M2 clearance holes)."
          : "On: fused into the carrier (needs heat-set pegs). Off: exported as a separate STL.",
        visibleWhen: isBoardCarrier,
        disabledWhen: (v) => hasScrewOnBoard(v) || v.Printed_or_Heat_Set_Pegs === "printed" },
      { param: "Alignment_Board_Type", label: "Board type", control: "segmented",
        help: (v) => hasScrewOnBoard(v)
          ? "Locked — this carrier takes only its own board."
          : "Used whether the board is fused or downloaded separately.",
        optionLabels: {
          "omega": "Omega D",
          "lpl-saunders": "LPL-Saunders",
          "beseler-23c": "Beseler 23C",
        },
        visibleWhen: isBoardCarrier,
        optionDisabledWhen: (_opt, v) => hasScrewOnBoard(v) },
      // Hidden (not just locked) for peg-less carriers: the SCAD's forced value
      // ("none") isn't one of this control's options, so there's nothing to show.
      { param: "Printed_or_Heat_Set_Pegs", label: "Pegs", control: "segmented",
        help: "Printed pegs can't be combined with the alignment board.",
        optionLabels: { "printed": "Printed", "heat_set": "Heat-set" },
        visibleWhen: hasFilmPegs,
        optionDisabledWhen: (opt, v) => opt === "printed" && v.Alignment_Board === true && isBoardCarrier(v) },
      { param: "Flip_Bottom_For_Printing", label: "Flip bottom for printing", control: "switch",
        help: (v) => isSinglePiece(v)
          ? "Locked off — the plate pocket must face up to print without supports."
          : undefined,
        disabledWhen: isSinglePiece },
    ],
  },
  {
    title: "Advanced",
    fields: [
      { param: "TEXT_ETCH_DEPTH", label: "Etch depth", control: "slider",
        min: 0.2, max: 3, step: 0.1, unit: "mm", advanced: true },
      { param: "Owner_Text_X_Offset", label: "Name X offset", control: "slider",
        min: -15, max: 15, step: 0.5, unit: "mm", advanced: true },
      { param: "Owner_Text_Y_Offset", label: "Name Y offset", control: "slider",
        min: -15, max: 15, step: 0.5, unit: "mm", advanced: true },
      { param: "Type_Text_X_Offset", label: "Type X offset", control: "slider",
        min: -15, max: 15, step: 0.5, unit: "mm", advanced: true },
      { param: "Type_Text_Y_Offset", label: "Type Y offset", control: "slider",
        min: -15, max: 15, step: 0.5, unit: "mm", advanced: true },
      { param: "Peg_Gap", label: "Peg gap", control: "slider",
        min: -2, max: 2, step: 0.1, unit: "mm", advanced: true },
      { param: "Adjust_Film_Width", label: "Adjust film width", control: "slider",
        min: -3, max: 3, step: 0.1, unit: "mm", advanced: true },
      { param: "Adjust_Film_Height", label: "Adjust film height", control: "slider",
        min: -3, max: 3, step: 0.1, unit: "mm", advanced: true },
      // Glass-plate pocket / notch fine-tuning (omega-d-glass only).
      { param: "Glass_Plate_Side_Play", label: "Plate side play (per side)", control: "slider",
        min: 0, max: 2, step: 0.1, unit: "mm", advanced: true, visibleWhen: isGlassCarrier },
      { param: "Glass_Plate_Depth_Play", label: "Plate depth play", control: "slider",
        min: 0, max: 1, step: 0.1, unit: "mm", advanced: true, visibleWhen: isGlassCarrier },
      { param: "Glass_Notch_Floor", label: "Notch floor (0 = through)", control: "slider",
        min: 0, max: 2, step: 0.1, unit: "mm", advanced: true,
        visibleWhen: (v) => isGlassCarrier(v) && v.Glass_Notch_Corner !== "none" },
      { param: "Glass_Notch_Reach", label: "Notch reach under plate", control: "slider",
        min: 0, max: 5, step: 0.5, unit: "mm", advanced: true,
        visibleWhen: (v) => isGlassCarrier(v) && v.Glass_Notch_Corner !== "none" },
    ],
  },
];

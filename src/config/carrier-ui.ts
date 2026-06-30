import type { GroupConfig, FormValue } from "../lib/form/types";

const isCustomFormat = (v: Record<string, FormValue>) => v.Film_Format === "custom";

// Carriers that have an alignment board (test frames don't).
const BOARD_CARRIERS = ["omega-d", "lpl-saunders-45xx", "beseler-23c"];
const isBoardCarrier = (v: Record<string, FormValue>) => BOARD_CARRIERS.includes(String(v.Carrier_Type));

export const CARRIER_UI: GroupConfig[] = [
  {
    title: "Carrier",
    fields: [
      { param: "Carrier_Type", label: "Enlarger", control: "cards", optionVisual: "carrier-outline",
        help: "Which enlarger this carrier fits.",
        optionLabels: {
          "omega-d": "Omega D Series",
          "lpl-saunders-45xx": "LPL-Saunders 45XX Series",
          "beseler-23c": "Beseler 23C Series",
          "beseler-45": "Beseler 45 Series",
          "frameAndPegTest": "Frame Size Test Print",
        } },
      { param: "Orientation", label: "Orientation", control: "segmented",
        help: "Ignored for 4×5.",
        optionLabels: { "vertical": "Vertical", "horizontal": "Horizontal" } },
      { param: "Top_or_Bottom", label: "Part", control: "segmented",
        help: "A full carrier needs both top and bottom printed.",
        optionLabels: { "top": "Top", "bottom": "Bottom" } },
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
        help: "On: fused into the carrier (needs heat-set pegs). Off: exported as a separate STL.",
        visibleWhen: isBoardCarrier,
        disabledWhen: (v) => v.Printed_or_Heat_Set_Pegs === "printed" },
      { param: "Alignment_Board_Type", label: "Board type", control: "segmented",
        help: "Used whether the board is fused or downloaded separately.",
        optionLabels: {
          "omega": "Omega D",
          "lpl-saunders": "LPL-Saunders",
          "beseler-23c": "Beseler 23C",
        },
        visibleWhen: isBoardCarrier },
      { param: "Printed_or_Heat_Set_Pegs", label: "Pegs", control: "segmented",
        help: "Printed pegs can't be combined with the alignment board.",
        optionLabels: { "printed": "Printed", "heat_set": "Heat-set" },
        optionDisabledWhen: (opt, v) => opt === "printed" && v.Alignment_Board === true && isBoardCarrier(v) },
      { param: "Flip_Bottom_For_Printing", label: "Flip bottom for printing", control: "switch" },
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
    ],
  },
];

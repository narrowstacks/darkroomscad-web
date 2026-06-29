import type { GroupConfig, FormValue } from "../lib/form/types";

const isCustomFormat = (v: Record<string, FormValue>) => v.Film_Format === "custom";

export const CARRIER_UI: GroupConfig[] = [
  {
    title: "Carrier",
    fields: [
      { param: "Carrier_Type", label: "Enlarger", help: "Which enlarger this carrier fits.",
        control: "cards", optionVisual: "carrier-outline" },
      { param: "Film_Format", label: "Film format" },
      { param: "Orientation", label: "Orientation", help: "Ignored for 4x5." },
      { param: "Top_or_Bottom", label: "Part", help: "A full carrier needs both top and bottom printed." },
    ],
  },
  {
    title: "Custom film format",
    fields: [
      { param: "Custom_Film_Width", label: "Film width (mm)", visibleWhen: isCustomFormat },
      { param: "Custom_Film_Height", label: "Film height (mm)", visibleWhen: isCustomFormat },
      { param: "Custom_Opening_Width", label: "Opening width (mm)", visibleWhen: isCustomFormat },
      { param: "Custom_Opening_Height", label: "Opening height (mm)", visibleWhen: isCustomFormat },
    ],
  },
  {
    title: "Text",
    fields: [
      { param: "Enable_Owner_Name_Etch", label: "Etch a name" },
      { param: "Owner_Name", label: "Name", visibleWhen: (v) => v.Enable_Owner_Name_Etch === true },
      { param: "Enable_Type_Name_Etch", label: "Etch the carrier type" },
      { param: "Type_Name", label: "Type label source", visibleWhen: (v) => v.Enable_Type_Name_Etch === true },
      { param: "Custom_Type_Name", label: "Custom type label",
        visibleWhen: (v) => v.Enable_Type_Name_Etch === true && v.Type_Name === "Custom" },
      { param: "Fontface", label: "Font", control: "select", optionsFrom: "fonts" },
      { param: "Font_Size", label: "Font size" },
    ],
  },
  {
    title: "Options",
    fields: [
      { param: "Alignment_Board", label: "Include alignment board" },
      { param: "Alignment_Board_Type", label: "Alignment board type",
        visibleWhen: (v) => v.Alignment_Board === true },
      { param: "Printed_or_Heat_Set_Pegs", label: "Pegs",
        help: "Heat-set required when including the alignment board." },
      { param: "Flip_Bottom_For_Printing", label: "Flip bottom for printing" },
    ],
  },
  {
    title: "Advanced",
    fields: [
      { param: "TEXT_ETCH_DEPTH", label: "Etch depth (mm)", advanced: true },
      { param: "Owner_Text_X_Offset", label: "Name X offset", advanced: true },
      { param: "Owner_Text_Y_Offset", label: "Name Y offset", advanced: true },
      { param: "Type_Text_X_Offset", label: "Type X offset", advanced: true },
      { param: "Type_Text_Y_Offset", label: "Type Y offset", advanced: true },
      { param: "Peg_Gap", label: "Peg gap (mm)", advanced: true },
      { param: "Adjust_Film_Width", label: "Adjust film width (mm)", advanced: true },
      { param: "Adjust_Film_Height", label: "Adjust film height (mm)", advanced: true },
      { param: "Text_As_Separate_Parts", label: "Separate text parts (multi-material)", advanced: true },
      { param: "Layer_Height_mm", label: "Layer height (mm)", advanced: true,
        visibleWhen: (v) => v.Text_As_Separate_Parts === true },
      { param: "Text_Layer_Multiple", label: "Text layers", advanced: true,
        visibleWhen: (v) => v.Text_As_Separate_Parts === true },
    ],
  },
];

// PROTOTYPE: render-target selection for the baked-base fast-preview path.
//
// The interactive preview can use carrier-baked.scad (import a pre-baked base body +
// native cuts, ~5-10x faster) when the requested config is within the prototype's
// baked coverage. Anything outside that coverage — and every final/export render —
// falls back to the exact parametric carrier.scad. This keeps output fidelity for
// exports while making the live preview cheap.
//
// Pure function so it is trivially unit-testable; the worker calls it to pick mainFile
// + params before handing off to renderScad.
import type { RenderRequest, RenderParams } from "./types";
import { BAKED_CARRIERS, BAKED_BOARD_TYPES, allows4x5Orientation } from "@/config/carriers";

export interface RenderTarget {
  mainFile: string;
  params: RenderParams;
  baked: boolean;
}

function str(params: RenderParams, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === "string" ? v : fallback;
}
function bool(params: RenderParams, key: string, fallback: boolean): boolean {
  const v = params[key];
  return typeof v === "boolean" ? v : fallback;
}

// Is the baked preview path valid for this request? Conservative: only the geometry
// the prototype actually bakes/cuts. Multi-material text part selection, non-baked
// carriers, non-omega boards, and final/export renders all force the parametric path.
export function supportsBakedPreview(req: RenderRequest): boolean {
  if (req.quality !== "preview") return false;
  if (req.preferBaked === false) return false;
  const carrier = str(req.params, "Carrier_Type", "omega-d");
  if (!BAKED_CARRIERS.has(carrier)) return false;
  // When a board is fused, it must be a baked board type.
  if (bool(req.params, "Alignment_Board", false) && !BAKED_BOARD_TYPES.has(str(req.params, "Alignment_Board_Type", "omega"))) return false;
  if (bool(req.params, "Text_As_Separate_Parts", false)) return false;
  const whichPart = str(req.params, "_WhichPart", "All");
  if (whichPart !== "All") return false;
  return true;
}

// The board STL for a request: omega has 4x5 variants (its widened cutout turns
// with the sheet on the carriers where 4x5 honours Orientation —
// get_effective_orientation); others are format-independent.
function boardStl(carrier: string, boardType: string, film: string, orientation: string): string {
  if (boardType !== "omega") return `/base-stls/board-${boardType}.stl`;
  if (film !== "4x5") return "/base-stls/board-omega.stl";
  return orientation === "vertical" && allows4x5Orientation(carrier)
    ? "/base-stls/board-omega-4x5-vertical.stl"
    : "/base-stls/board-omega-4x5.stl";
}

export function selectRenderTarget(req: RenderRequest): RenderTarget {
  if (!supportsBakedPreview(req)) {
    return { mainFile: req.mainFile ?? "carrier.scad", params: req.params, baked: false };
  }
  const carrier = str(req.params, "Carrier_Type", "omega-d");
  const topOrBottom = str(req.params, "Top_or_Bottom", "bottom");
  const boardType = str(req.params, "Alignment_Board_Type", "omega");
  const film = str(req.params, "Film_Format", "35mm");
  const orientation = str(req.params, "Orientation", "vertical");
  return {
    mainFile: "carrier-baked.scad",
    params: {
      ...req.params,
      Baked_Base_Stl: `/base-stls/${carrier}-${topOrBottom}.stl`,
      Baked_Board_Stl: boardStl(carrier, boardType, film, orientation),
    },
    baked: true,
  };
}

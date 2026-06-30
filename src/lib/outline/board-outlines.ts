// Alignment-board value -> outline geometry (outer outline + opening). Render
// with fill-rule="evenodd".
//
// The DATA lives in generated/board-outlines.json (produced by
// scripts/gen-carrier-outlines.ts) — do not hand-edit the JSON; run
// `npm run gen:outlines` to regenerate. This module is just the typed loader, so
// it IS safe to edit.
import data from "../../../generated/board-outlines.json";

export interface BoardOutline { viewBox: string; d: string; }

export const BOARD_OUTLINES: Record<string, BoardOutline> = data;

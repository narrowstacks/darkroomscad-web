// Carrier value -> outline geometry (viewBox + SVG path), rendered inline with
// fill="currentColor" so the silhouette follows the theme text color.
//
// The DATA lives in generated/carrier-outlines.json (produced by
// scripts/gen-carrier-outlines.ts, which also writes public/outlines/*.svg) — do
// not hand-edit the JSON; run `npm run gen:outlines` to regenerate. This module is
// just the typed loader, so it IS safe to edit (add a helper, change the type…).
//
// Keys: "<carrier>" (bottom) and "<carrier>:top" (top — has the corner
// separation-hole notch).
import data from "../../../generated/carrier-outlines.json";

export interface CarrierOutline { viewBox: string; d: string; }

export const CARRIER_OUTLINES: Record<string, CarrierOutline> = data;

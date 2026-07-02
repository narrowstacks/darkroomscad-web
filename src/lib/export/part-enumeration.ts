import type { RenderParams } from "../openscad/types";
import { BOARD_CARRIERS } from "@/config/carriers";

export interface PartJob {
  name: string;
  params: RenderParams;
}

function slug(s: string): string {
  return s.replace(/\s+/g, "-");
}

export function enumerateParts(form: RenderParams): PartJob[] {
  const carrier = slug(String(form.Carrier_Type ?? "carrier"));
  const format = slug(String(form.Film_Format ?? "format"));
  const orient = slug(String(form.Orientation ?? "vertical"));
  const multimat = form.Text_As_Separate_Parts === true;

  const job = (half: string, whichPart: string, suffix: string): PartJob => ({
    name: `${carrier}_${format}_${orient}_${half}${suffix}.stl`,
    params: {
      ...form,
      Top_or_Bottom: half,
      _WhichPart: whichPart,
      Text_As_Separate_Parts: multimat,
      Render_Quality: "final",
    },
  });

  const jobs: PartJob[] = [];
  for (const half of ["top", "bottom"]) {
    if (!multimat) {
      jobs.push(job(half, "All", ""));
    } else {
      jobs.push(job(half, "Base", "_base"));
      if (form.Enable_Owner_Name_Etch === true) jobs.push(job(half, "OwnerText", "_owner-text"));
      if (form.Enable_Type_Name_Etch === true) jobs.push(job(half, "TypeText", "_type-text"));
    }
  }

  // Standalone alignment board: when it isn't fused into the carrier (detached —
  // e.g. printed pegs), export the board as its own printable STL so the set is
  // still complete. When attached (Alignment_Board === true) it's already in the
  // bottom half, so don't duplicate it.
  if (BOARD_CARRIERS.has(String(form.Carrier_Type)) && form.Alignment_Board !== true) {
    const boardType = slug(String(form.Alignment_Board_Type ?? "omega"));
    jobs.push({
      name: `${carrier}_${boardType}-alignment-board.stl`,
      params: {
        ...form,
        _Render_Alignment_Board_Only: true,
        Render_Quality: "final",
      },
    });
  }
  return jobs;
}

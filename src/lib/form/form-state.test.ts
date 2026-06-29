import { describe, it, expect } from "vitest";
import { initialValues, visibleFields, toRenderParams } from "./form-state";
import type { ResolvedGroup } from "./types";

const groups: ResolvedGroup[] = [
  { title: "G", fields: [
    { param: "A", label: "A", advanced: false, control: "text", default: "x" },
    { param: "B", label: "B", advanced: false, control: "number", default: 5,
      visibleWhen: (v) => v.A === "show" },
  ] },
];

describe("form-state", () => {
  it("initialValues collects each field's default", () => {
    expect(initialValues(groups)).toEqual({ A: "x", B: 5 });
  });

  it("visibleFields hides fields whose visibleWhen is false", () => {
    expect(visibleFields(groups, { A: "x", B: 5 }).map((f) => f.param)).toEqual(["A"]);
    expect(visibleFields(groups, { A: "show", B: 5 }).map((f) => f.param)).toEqual(["A", "B"]);
  });

  it("toRenderParams emits only visible fields plus system overrides", () => {
    const hidden = toRenderParams(groups, { A: "x", B: 5 }, { Render_Quality: "preview" });
    expect(hidden).toEqual({ A: "x", Render_Quality: "preview" }); // B hidden
    const shown = toRenderParams(groups, { A: "show", B: 5 }, { Render_Quality: "final" });
    expect(shown).toEqual({ A: "show", B: 5, Render_Quality: "final" });
  });
});

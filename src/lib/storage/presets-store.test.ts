import { describe, it, expect } from "vitest";
import {
  parsePresets, upsertPreset, deletePreset, sanitizePresetValues, mergePresets, type Preset,
} from "./presets-store";

const p = (id: string, name: string, values = { Font_Size: 10 }): Preset => ({ id, name, values });

describe("parsePresets", () => {
  it("returns [] for null, corrupt, or non-array input", () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("{bad")).toEqual([]);
    expect(parsePresets('{"id":"a"}')).toEqual([]);
  });

  it("drops entries missing required fields", () => {
    const raw = JSON.stringify([
      p("a", "Good"),
      { id: "b" },                       // no name/values
      { name: "no id", values: {} },     // no id
      { id: "c", name: "no values" },    // no values
    ]);
    expect(parsePresets(raw)).toEqual([p("a", "Good")]);
  });
});

describe("upsertPreset", () => {
  it("appends a new preset, trimming the name", () => {
    const out = upsertPreset([], "  Portra Setup  ", { Font_Size: 12 }, "id1");
    expect(out).toEqual([{ id: "id1", name: "Portra Setup", values: { Font_Size: 12 } }]);
  });

  it("overwrites an existing preset by case-insensitive name (keeps its id)", () => {
    const list = [p("id1", "My Preset", { Font_Size: 10 })];
    const out = upsertPreset(list, "my preset", { Font_Size: 20 }, "id2");
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: "id1", name: "My Preset", values: { Font_Size: 20 } });
  });
});

describe("deletePreset", () => {
  it("removes the preset with the given id, leaving others", () => {
    const list = [p("a", "A"), p("b", "B")];
    expect(deletePreset(list, "a")).toEqual([p("b", "B")]);
  });
});

describe("sanitizePresetValues", () => {
  it("keeps primitive values and drops objects, arrays, and null", () => {
    const out = sanitizePresetValues({
      str: "x",
      num: 1,
      bool: true,
      obj: { nested: 1 },
      arr: [1, 2],
      nil: null,
      undef: undefined,
    });
    expect(out).toEqual({ str: "x", num: 1, bool: true });
  });
});

describe("mergePresets", () => {
  it("adds new presets by name and regenerates ids", () => {
    let n = 0;
    const newId = () => `new-${++n}`;
    const { list, added, updated } = mergePresets([], [p("orig-1", "A"), p("orig-2", "B")], newId);
    expect(added).toBe(2);
    expect(updated).toBe(0);
    expect(list.map((x) => x.id)).toEqual(["new-1", "new-2"]);
    expect(list.map((x) => x.name)).toEqual(["A", "B"]);
  });

  it("updates existing presets by case-insensitive name, keeping the existing id", () => {
    const existing = [p("id1", "My Preset", { Font_Size: 10 })];
    const newId = () => "unused";
    const { list, added, updated } = mergePresets(
      existing, [p("orig", "my preset", { Font_Size: 99 })], newId,
    );
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ id: "id1", name: "My Preset", values: { Font_Size: 99 } });
  });

  it("empty incoming list is a no-op", () => {
    const existing = [p("id1", "A")];
    const { list, added, updated } = mergePresets(existing, [], () => "unused");
    expect(list).toEqual(existing);
    expect(added).toBe(0);
    expect(updated).toBe(0);
  });
});

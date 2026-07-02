// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePresets } from "./use-presets";
import type { Preset } from "@/lib/storage/presets-store";

const PRESETS_KEY = "darkroomscad:presets:v1";

describe("usePresets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("save returns the created preset and adds it to the list", () => {
    const { result } = renderHook(() => usePresets());
    let p: Preset | undefined;
    act(() => {
      p = result.current.save("My Preset", { Owner_Name: "X" });
    });
    expect(p!.name).toBe("My Preset");
    expect(p!.id).toBeTruthy();
    expect(result.current.presets).toHaveLength(1);
  });

  it("save with same name (case-insensitive) overwrites the existing preset", () => {
    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.save("foo", { Owner_Name: "first" });
    });
    let p: Preset | undefined;
    act(() => {
      p = result.current.save("FOO", { Owner_Name: "second" });
    });
    expect(result.current.presets).toHaveLength(1);
    expect(p!.values.Owner_Name).toBe("second");
  });

  it("remove deletes a preset and persists the change", () => {
    const { result } = renderHook(() => usePresets());
    let p: Preset | undefined;
    act(() => {
      p = result.current.save("Removable", { Owner_Name: "X" });
    });
    act(() => {
      result.current.remove(p!.id);
    });
    expect(result.current.presets).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(PRESETS_KEY)!)).toEqual([]);
  });

  it("loads persisted presets on mount", () => {
    localStorage.setItem(
      PRESETS_KEY,
      JSON.stringify([{ id: "p-1", name: "Existing", values: { Owner_Name: "X" } }]),
    );
    const { result } = renderHook(() => usePresets());
    expect(result.current.presets).toHaveLength(1);
  });

  it("importAll adds both presets from a valid two-preset JSON", () => {
    const { result } = renderHook(() => usePresets());
    const raw = JSON.stringify([
      { id: "orig-1", name: "Imported A", values: { Owner_Name: "A" } },
      { id: "orig-2", name: "Imported B", values: { Owner_Name: "B" } },
    ]);
    let outcome: { added: number; updated: number } | null = null;
    act(() => {
      outcome = result.current.importAll(raw);
    });
    expect(outcome).toEqual({ added: 2, updated: 0 });
    expect(result.current.presets).toHaveLength(2);
    expect(result.current.presets.map((p) => p.name).sort()).toEqual(["Imported A", "Imported B"]);
    expect(JSON.parse(localStorage.getItem(PRESETS_KEY)!)).toHaveLength(2);
  });

  it("importAll returns null and leaves state unchanged for garbage input", () => {
    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.save("Keep Me", { Owner_Name: "X" });
    });
    let outcome: { added: number; updated: number } | null = { added: 99, updated: 99 };
    act(() => {
      outcome = result.current.importAll("not json");
    });
    expect(outcome).toBeNull();
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].name).toBe("Keep Me");
  });

  it("importAll updates an existing preset by case-insensitive name instead of duplicating", () => {
    const { result } = renderHook(() => usePresets());
    act(() => {
      result.current.save("My Preset", { Owner_Name: "first" });
    });
    const raw = JSON.stringify([
      { id: "orig-1", name: "my preset", values: { Owner_Name: "second" } },
    ]);
    let outcome: { added: number; updated: number } | null = null;
    act(() => {
      outcome = result.current.importAll(raw);
    });
    expect(outcome).toEqual({ added: 0, updated: 1 });
    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].values.Owner_Name).toBe("second");
  });
});

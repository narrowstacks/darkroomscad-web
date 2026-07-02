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
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCarrierForm } from "./use-carrier-form";

const CONFIG_KEY = "darkroomscad:config:v1";

describe("useCarrierForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds defaults from the param schema", () => {
    const { result } = renderHook(() => useCarrierForm());
    expect(typeof result.current.values.Carrier_Type).toBe("string");
    expect(result.current.values.Carrier_Type).not.toBe("");
    expect(result.current.values.Film_Format).toBeDefined();
  });

  it("restores persisted config on mount, filtering unknown keys", () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ Owner_Name: "TEST", Not_A_Param: "x" }),
    );
    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Owner_Name).toBe("TEST");
    expect("Not_A_Param" in result.current.values).toBe(false);
  });

  it("applyValues filters unknown keys", () => {
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.applyValues({ Owner_Name: "A", Bogus_Key: "b" });
    });
    expect(result.current.values.Owner_Name).toBe("A");
    expect("Bogus_Key" in result.current.values).toBe(false);
  });

  it("debounces persistence to localStorage", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.setValue("Owner_Name", "Z");
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY)!);
    expect(stored.Owner_Name).toBe("Z");
  });

  it("reset returns to the seed values", () => {
    const fresh = renderHook(() => useCarrierForm());
    const seedValues = fresh.result.current.values;

    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.setValue("Owner_Name", "CHANGED");
    });
    expect(result.current.values.Owner_Name).toBe("CHANGED");
    act(() => {
      result.current.reset();
    });
    expect(result.current.values).toEqual(seedValues);
  });
});

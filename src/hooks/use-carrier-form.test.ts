// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCarrierForm } from "./use-carrier-form";
import { encodeShare } from "@/lib/share/permalink";

const CONFIG_KEY = "darkroomscad:config:v1";

function setHash(hash: string) {
  window.history.replaceState(null, "", window.location.pathname + hash);
}

describe("useCarrierForm", () => {
  beforeEach(() => {
    localStorage.clear();
    setHash("");
  });

  afterEach(() => {
    vi.useRealTimers();
    setHash("");
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

  it("normalizes a conflicting board/printed-pegs pair restored from localStorage", () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ Alignment_Board: true, Printed_or_Heat_Set_Pegs: "printed" }),
    );
    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Alignment_Board).toBe(true);
    expect(result.current.values.Printed_or_Heat_Set_Pegs).toBe("heat_set");
  });

  it("applyValues normalizes a conflicting board/printed-pegs pair", () => {
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.applyValues({ Alignment_Board: true, Printed_or_Heat_Set_Pegs: "printed" });
    });
    expect(result.current.values.Alignment_Board).toBe(true);
    expect(result.current.values.Printed_or_Heat_Set_Pegs).toBe("heat_set");
  });

  it("applyValues leaves a legit board/heat_set pair untouched", () => {
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.applyValues({ Alignment_Board: true, Printed_or_Heat_Set_Pegs: "heat_set" });
    });
    expect(result.current.values.Alignment_Board).toBe(true);
    expect(result.current.values.Printed_or_Heat_Set_Pegs).toBe("heat_set");
  });

  it("normalizes 4x5 on the beseler-23c (unsupported) back to 35mm", () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ Carrier_Type: "beseler-23c", Film_Format: "4x5" }),
    );
    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Carrier_Type).toBe("beseler-23c");
    expect(result.current.values.Film_Format).toBe("35mm");
  });

  it("switching to beseler-23c while 4x5 is selected falls back to 35mm", () => {
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.setValue("Carrier_Type", "beseler-45");
      result.current.setValue("Film_Format", "4x5");
    });
    expect(result.current.values.Film_Format).toBe("4x5");
    act(() => {
      result.current.setValue("Carrier_Type", "beseler-23c");
    });
    expect(result.current.values.Film_Format).toBe("35mm");
  });

  it("pins Orientation to horizontal while 4x5 is selected", () => {
    const { result } = renderHook(() => useCarrierForm());
    act(() => {
      result.current.setValue("Orientation", "vertical");
      result.current.setValue("Film_Format", "4x5");
    });
    expect(result.current.values.Orientation).toBe("horizontal");
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

  it("applies a shared-link (#c=) config over localStorage and clears the hash", () => {
    const seedResult = renderHook(() => useCarrierForm());
    const seedValues = seedResult.result.current.values;

    localStorage.setItem(CONFIG_KEY, JSON.stringify({ Owner_Name: "FROM_STORAGE" }));
    const payload = encodeShare({ ...seedValues, Owner_Name: "FROM_URL" }, seedValues);
    setHash("#c=" + payload);

    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Owner_Name).toBe("FROM_URL");
    expect(window.location.hash).toBe("");
  });

  it("leaves an invalid shared-link hash untouched and behaves as if absent", () => {
    setHash("#c=not-a-valid-payload!!");
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ Owner_Name: "FROM_STORAGE" }));

    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Owner_Name).toBe("FROM_STORAGE");
    expect(window.location.hash).toBe("#c=not-a-valid-payload!!");
  });

  it("normalizes a conflicting board/printed-pegs pair ingested via the shared-link hash", () => {
    const seedResult = renderHook(() => useCarrierForm());
    const seedValues = seedResult.result.current.values;

    const payload = encodeShare(
      { ...seedValues, Alignment_Board: true, Printed_or_Heat_Set_Pegs: "printed" },
      seedValues,
    );
    setHash("#c=" + payload);

    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.values.Alignment_Board).toBe(true);
    expect(result.current.values.Printed_or_Heat_Set_Pegs).toBe("heat_set");
  });

  it("shareLink encodes the current diff and is empty at the seed", () => {
    const { result } = renderHook(() => useCarrierForm());
    expect(result.current.shareLink()).toBe("");
    act(() => {
      result.current.setValue("Owner_Name", "SHARE_ME");
    });
    const link = result.current.shareLink();
    expect(link).toContain("#c=");
    expect(link.length).toBeGreaterThan(0);
  });
});

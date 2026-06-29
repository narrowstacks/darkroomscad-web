import { describe, it, expect } from "vitest";
import { coerceOptionValue, clampSlider } from "./control-value";

describe("coerceOptionValue", () => {
  it("returns the typed (number) value for a matching numeric option", () => {
    const opts = [{ value: 1, label: "One" }, { value: 2, label: "Two" }];
    expect(coerceOptionValue(opts, "2")).toBe(2);
    expect(typeof coerceOptionValue(opts, "2")).toBe("number");
  });
  it("returns the string value for a matching string option", () => {
    const opts = [{ value: "omega-d", label: "Omega" }];
    expect(coerceOptionValue(opts, "omega-d")).toBe("omega-d");
  });
  it("falls back to the raw string when there are no options", () => {
    expect(coerceOptionValue(undefined, "x")).toBe("x");
  });
});

describe("clampSlider", () => {
  it("clamps to min and max when provided", () => {
    expect(clampSlider(5, 0, 10)).toBe(5);
    expect(clampSlider(-3, 0, 10)).toBe(0);
    expect(clampSlider(99, 0, 10)).toBe(10);
  });
  it("passes through when bounds are absent", () => {
    expect(clampSlider(42)).toBe(42);
  });
});

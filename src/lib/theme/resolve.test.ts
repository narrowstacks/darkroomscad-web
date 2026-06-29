import { describe, it, expect } from "vitest";
import { resolveInitialTheme, nextTheme } from "./resolve";

describe("resolveInitialTheme", () => {
  it("uses the stored theme when valid", () => {
    expect(resolveInitialTheme("light", true)).toBe("light");
    expect(resolveInitialTheme("darkroom", false)).toBe("darkroom");
  });
  it("falls back to prefers-color-scheme when unset/invalid", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
    expect(resolveInitialTheme("bogus", false)).toBe("light");
  });
});

describe("nextTheme", () => {
  it("cycles dark -> light -> darkroom -> high-contrast -> dark", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("darkroom");
    expect(nextTheme("darkroom")).toBe("high-contrast");
    expect(nextTheme("high-contrast")).toBe("dark");
  });
});

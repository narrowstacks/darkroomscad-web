// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadViewMode, saveViewMode } from "./view-mode";

describe("view-mode persistence", () => {
  beforeEach(() => localStorage.clear());
  it("defaults to 2d when nothing stored", () => {
    expect(loadViewMode()).toBe("2d");
  });
  it("round-trips a saved mode", () => {
    saveViewMode("3d");
    expect(loadViewMode()).toBe("3d");
  });
  it("ignores invalid stored values", () => {
    localStorage.setItem("darkroomscad-view-mode", "garbage");
    expect(loadViewMode()).toBe("2d");
  });
});

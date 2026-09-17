import { describe, it, expect } from "vitest";
import { formatSlug } from "./format-slug";

describe("formatSlug", () => {
  it("collapses whitespace in the format name", () => {
    expect(formatSlug({ Film_Format: "35mm filed" })).toBe("35mm-filed");
    expect(formatSlug({})).toBe("format");
  });
  it("appends -x<n> for multi-frame openings", () => {
    expect(formatSlug({ Film_Format: "35mm", Frame_Count: 2 })).toBe("35mm-x2");
    expect(formatSlug({ Film_Format: "6x6 filed", Frame_Count: 3 })).toBe("6x6-filed-x3");
    expect(formatSlug({ Film_Format: "35mm", Frame_Count: "2" })).toBe("35mm-x2"); // string from a share link
  });
  it("never suffixes a single frame, 4x5, or custom", () => {
    expect(formatSlug({ Film_Format: "35mm", Frame_Count: 1 })).toBe("35mm");
    expect(formatSlug({ Film_Format: "4x5", Frame_Count: 2 })).toBe("4x5");
    expect(formatSlug({ Film_Format: "custom", Frame_Count: 2 })).toBe("custom");
  });
});

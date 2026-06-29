import { describe, it, expect } from "vitest";
import { parseCustomizer } from "./parse-customizer";

describe("parseCustomizer", () => {
  it("parses a string dropdown with section", () => {
    const scad = [
      "/* [Carrier Type] */",
      "Orientation = \"vertical\"; // [\"vertical\", \"horizontal\"]",
    ].join("\n");
    const { params } = parseCustomizer(scad);
    expect(params).toHaveLength(1);
    expect(params[0]).toMatchObject({
      name: "Orientation",
      section: "Carrier Type",
      type: "enum",
      default: "vertical",
      hidden: false,
      options: [
        { value: "vertical", label: "vertical" },
        { value: "horizontal", label: "horizontal" },
      ],
    });
  });

  it("captures the preceding comment as description", () => {
    const scad = [
      "/* [Customization] */",
      "// Name to etch on the carrier",
      "Owner_Name = \"NAME\";",
    ].join("\n");
    const { params } = parseCustomizer(scad);
    expect(params[0].description).toBe("Name to etch on the carrier");
    expect(params[0].type).toBe("string");
    expect(params[0].default).toBe("NAME");
  });

  it("parses a boolean value", () => {
    const scad = "Alignment_Board = true; // [true, false]";
    const { params } = parseCustomizer(scad);
    expect(params[0]).toMatchObject({ type: "boolean", default: true });
  });

  it("parses a numeric range annotation", () => {
    const scad = "Font_Size = 10; // [6:0.5:40]";
    const { params } = parseCustomizer(scad);
    expect(params[0]).toMatchObject({
      type: "number",
      default: 10,
      min: 6,
      step: 0.5,
      max: 40,
    });
  });

  it("parses a bare numeric value with no annotation", () => {
    const scad = "Custom_Film_Width = 37;";
    const { params } = parseCustomizer(scad);
    expect(params[0]).toMatchObject({ type: "number", default: 37 });
  });

  it("marks params under /* [Hidden] */ as hidden", () => {
    const scad = [
      "/* [Hidden] */",
      "$fn = 100;",
    ].join("\n");
    const { params } = parseCustomizer(scad);
    expect(params[0].hidden).toBe(true);
  });

  it("ignores include/use lines and non-assignment code", () => {
    const scad = [
      "include <BOSL2/std.scad>",
      "module foo() { cube(1); }",
      "Owner_Name = \"NAME\";",
    ].join("\n");
    const { params } = parseCustomizer(scad);
    expect(params.map((p) => p.name)).toEqual(["Owner_Name"]);
  });

  it("clears a pending description on a non-comment, non-assignment line", () => {
    const scad = [
      "// some comment",
      "module foo() { cube(1); }",
      "Owner_Name = \"X\";",
    ].join("\n");
    const { params } = parseCustomizer(scad);
    expect(params[0].description).toBeUndefined();
  });
});

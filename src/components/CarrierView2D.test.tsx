// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CarrierView2D } from "./CarrierView2D";

describe("CarrierView2D", () => {
  it("renders an SVG with the body path and four peg circles for a default omega config", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Top_or_Bottom: "bottom", Printed_or_Heat_Set_Pegs: "heat_set" }} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector("path[data-layer='body']")).not.toBeNull();
    expect(svg!.querySelectorAll("circle[data-layer='peg']").length).toBe(4);
  });

  it("renders text when an etch is enabled", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Enable_Owner_Name_Etch: true, Owner_Name: "ADA" }} />,
    );
    expect(container.querySelector("text")?.textContent).toContain("ADA");
  });

  it("renders no dimension layer by default", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm" }} />,
    );
    expect(container.querySelectorAll("[data-layer='dimension']").length).toBe(0);
  });

  it("renders the dimension layer (lines + labels) when showDimensions is set", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm" }} showDimensions />,
    );
    const layer = container.querySelectorAll("[data-layer='dimension']");
    expect(layer.length).toBeGreaterThanOrEqual(4);
    // Each of the 4 callouts renders a background-halo underlay line + an ink
    // line on top (see the dimension halo in CarrierView2D), so 4 callouts → 8.
    const lines = container.querySelectorAll("line[data-layer='dimension']");
    expect(lines.length).toBe(8);
    const labels = Array.from(container.querySelectorAll("text[data-layer='dimension']"));
    expect(labels.length).toBe(4);
    expect(labels.some((t) => t.textContent?.includes("mm"))).toBe(true);
  });
});

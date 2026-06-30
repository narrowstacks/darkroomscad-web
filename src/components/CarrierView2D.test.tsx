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
});

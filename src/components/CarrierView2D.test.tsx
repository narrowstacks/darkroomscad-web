// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CarrierView2D } from "./CarrierView2D";

describe("CarrierView2D", () => {
  afterEach(cleanup);

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

  it("renders the four alignment-screw footprint holes for an omega config with no attached board", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Alignment_Board: false }} />,
    );
    expect(container.querySelectorAll("circle[data-layer='screw']").length).toBe(4);
  });

  it("renders no film layer by default", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm" }} />,
    );
    expect(container.querySelectorAll("[data-layer='film']").length).toBe(0);
  });

  it("renders the film overlay (base + sprockets + frames) when showFilm is set", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm" }} showFilm />,
    );
    // Base rect + two sprocket rows + tiled image frames — many elements.
    expect(container.querySelectorAll("[data-layer='film']").length).toBeGreaterThan(4);
  });

  it("widens the opening for a multi-frame config and centers the film frames on it", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Frame_Count: 2 }} showFilm />,
    );
    // 2 × 35mm vertical: 74 wide × 24 tall chamfered rect (spans x = ±37).
    const d = container.querySelector("path[data-layer='opening']")!.getAttribute("d")!;
    expect(d).toContain("37,-11.5");
    expect(d).toContain("-37,11.5");
    // Frames straddle the origin (centers at ±19): rect x = 19 - 18 = 1 and -19 - 18 = -37.
    const xs = Array.from(container.querySelectorAll("rect[data-layer='film']")).map((r) => r.getAttribute("x"));
    expect(xs).toContain("1");
    expect(xs).toContain("-37");
  });

  it("shows no fit warning for a standard config", () => {
    const { queryByTestId } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Frame_Count: 3 }} />,
    );
    expect(queryByTestId("fit-warning")).toBeNull();
  });

  it("warns when the opening runs past the body / is masked by the board", () => {
    // 3 × 6x6 vertical on the omega-d: 174mm opening overruns the body and the omega board.
    const { getByTestId } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "6x6", Frame_Count: 3, Alignment_Board_Type: "omega" }} />,
    );
    const text = getByTestId("fit-warning").textContent ?? "";
    expect(text).toContain("runs past the carrier body");
    expect(text).toContain("Omega D alignment board");
  });

  it("checks the board cutout even when the board isn't attached (it's still printed and stacked)", () => {
    // 4 × 35mm vertical (150mm) fits the omega-d body but not the omega board's 119mm cutout.
    const { getByTestId } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d", Film_Format: "35mm", Frame_Count: 4, Alignment_Board: false, Alignment_Board_Type: "omega" }} />,
    );
    const text = getByTestId("fit-warning").textContent ?? "";
    expect(text).not.toContain("runs past");
    expect(text).toContain("Omega D alignment board");
  });

  it("omega-d-glass: draws the plate pocket + notch recesses, the screw-on board ghost, no film pegs", () => {
    const { container } = render(
      <CarrierView2D values={{ Carrier_Type: "omega-d-glass", Film_Format: "4x5", Top_or_Bottom: "top", Alignment_Board: false }} />,
    );
    expect(container.querySelectorAll("rect[data-layer='recess']").length).toBe(1);
    expect(container.querySelectorAll("circle[data-layer='recess']").length).toBe(1);
    expect(container.querySelectorAll("circle[data-layer='peg']").length).toBe(0);
    expect(container.querySelectorAll("circle[data-layer='screw']").length).toBe(4);
    // Board ghost (dashed path) is present even though Alignment_Board is off.
    expect(container.querySelector("path[stroke-dasharray]")).not.toBeNull();
    expect(container.querySelector("path[data-layer='body']")).not.toBeNull();
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

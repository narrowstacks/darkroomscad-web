// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { CardSelect } from "./CardSelect";

const options = [
  { value: "omega-d", label: "Omega D" },
  { value: "omega-d-glass", label: "Glass" },
  { value: "beseler-23c", label: "Beseler" },
];

describe("CardSelect sections", () => {
  afterEach(cleanup);

  it("renders one grid under the label when there are no sections", () => {
    const { getAllByRole } = render(<CardSelect options={options} value="omega-d" onChange={() => {}} label="Enlarger" />);
    expect(getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual(["Enlarger"]);
    expect(getAllByRole("button")).toHaveLength(3);
  });

  it("pulls sectioned options out of the main grid into their own titled grid, keeping selection + onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <CardSelect options={options} value="omega-d-glass" onChange={onChange} label="Enlarger"
        sections={[{ title: "Special", values: ["omega-d-glass"] }]} />,
    );
    const main = getByRole("group", { name: "Enlarger" });
    const special = getByRole("group", { name: "Special" });
    expect(Array.from(main.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Omega D", "Beseler"]);
    expect(Array.from(special.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Glass"]);
    expect(special.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(main.querySelector("button")!);
    expect(onChange).toHaveBeenCalledWith("omega-d");
  });

  it("omits a section none of whose values are offered", () => {
    const { queryByRole } = render(
      <CardSelect options={options} value="omega-d" onChange={() => {}} label="Enlarger"
        sections={[{ title: "Special", values: ["nope"] }]} />,
    );
    expect(queryByRole("group", { name: "Special" })).toBeNull();
  });
});

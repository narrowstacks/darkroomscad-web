// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ExportPanel } from "./ExportPanel";
import { enumerateParts } from "@/lib/export/part-enumeration";
import type { RenderClient } from "@/lib/openscad/client";
import type { RenderParams, RenderRequest, RenderResult } from "@/lib/openscad/types";

type RenderFn = (req: RenderRequest) => Promise<RenderResult>;

function fakeClient(render: RenderFn): () => RenderClient {
  return () => ({ render } as unknown as RenderClient);
}

const params: RenderParams = { Carrier_Type: "omega-d", Film_Format: "35mm", Orientation: "vertical" };
const getParams = () => params;

function okResult(): RenderResult {
  return { stl: new Uint8Array(100), log: "", durationMs: 1 };
}

describe("ExportPanel", () => {
  beforeAll(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
  });

  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("happy path: renders all parts and triggers a ZIP download", async () => {
    let calls = 0;
    const client = fakeClient(async () => {
      calls++;
      return okResult();
    });
    render(<ExportPanel client={client} getParams={getParams} />);

    const zipButton = screen.getByRole("button", { name: /Download set \(ZIP\)/i }) as HTMLButtonElement;
    fireEvent.click(zipButton);

    await waitFor(() => expect(zipButton.disabled).toBe(false));

    expect(calls).toBeGreaterThanOrEqual(2);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("error path: shows an error box and re-enables the ZIP button", async () => {
    const client = fakeClient(async () => {
      throw new Error("boom");
    });
    render(<ExportPanel client={client} getParams={getParams} />);

    const zipButton = screen.getByRole("button", { name: /Download set \(ZIP\)/i }) as HTMLButtonElement;
    fireEvent.click(zipButton);

    const errorLabel = await screen.findByText(/Export failed\./);
    expect(errorLabel.parentElement?.textContent).toContain("boom");
    expect(zipButton.disabled).toBe(false);
  });

  it("error clears on retry", async () => {
    let shouldFail = true;
    const client = fakeClient(async () => {
      if (shouldFail) throw new Error("boom");
      return okResult();
    });
    render(<ExportPanel client={client} getParams={getParams} />);

    const zipButton = screen.getByRole("button", { name: /Download set \(ZIP\)/i });
    fireEvent.click(zipButton);
    await screen.findByText(/Export failed\./);

    shouldFail = false;
    fireEvent.click(zipButton);

    await waitFor(() => expect(screen.queryByText(/Export failed\./)).toBeNull());
  });

  it("individual parts list shows a row per enumerated part", async () => {
    const client = fakeClient(async () => okResult());
    render(<ExportPanel client={client} getParams={getParams} />);

    fireEvent.click(screen.getByRole("button", { name: /Download individual parts/i }));
    fireEvent.click(screen.getByRole("button", { name: /Render all parts/i }));

    const expectedNames = enumerateParts(params).map((j) => j.name);
    await waitFor(() => {
      for (const name of expectedNames) {
        expect(screen.getByText(name)).toBeTruthy();
      }
    });
  });
});

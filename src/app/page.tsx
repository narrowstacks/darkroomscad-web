"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RenderClient } from "@/lib/openscad/client";
import { PreviewController, type PreviewState } from "@/lib/openscad/preview-controller";
import { useCarrierForm } from "@/hooks/use-carrier-form";
import { CarrierForm } from "@/components/CarrierForm";
import { StlViewer } from "@/components/StlViewer";

function newClient(): RenderClient {
  const worker = new Worker(new URL("../lib/openscad/worker.ts", import.meta.url), { type: "module" });
  return new RenderClient(worker);
}

export default function Home() {
  const { groups, values, setValue, toParams } = useCarrierForm();
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [downloading, setDownloading] = useState(false);
  const clientRef = useRef<RenderClient | null>(null);
  const ctlRef = useRef<PreviewController | null>(null);

  // Lazily create the worker client + preview controller (client-only).
  function controller(): PreviewController {
    if (!clientRef.current) clientRef.current = newClient();
    if (!ctlRef.current) {
      ctlRef.current = new PreviewController(clientRef.current, {
        debounceMs: 400,
        onState: setPreview,
      });
    }
    return ctlRef.current;
  }

  // Request a preview whenever params change (and once on mount).
  const params = useMemo(() => toParams({ Render_Quality: "preview" }), [toParams]);
  useEffect(() => {
    controller().request(params);
  }, [params]);

  useEffect(() => () => { ctlRef.current?.dispose(); clientRef.current?.dispose(); }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await (clientRef.current ?? (clientRef.current = newClient()))
        .render({ params: toParams({ Render_Quality: "final" }), quality: "final" });
      const blob = new Blob([new Uint8Array(result.stl)], { type: "model/stl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ct = String(values.Carrier_Type), ff = String(values.Film_Format);
      const part = String(values.Top_or_Bottom);
      a.href = url;
      a.download = `${ct}_${ff}_${part}.stl`.replace(/\s+/g, "-");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">DarkroomSCAD</h1>
        <p style={{ color: "var(--text-muted)" }}>Configure your negative carrier and download a print-ready STL.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(320px,420px)_1fr]">
        <div>
          <CarrierForm groups={groups} values={values} setValue={setValue} />
          <button onClick={handleDownload} disabled={downloading || preview.status === "error"}
            className="mt-6 w-full rounded px-4 py-2.5 font-medium"
            style={{ background: "var(--primary)", color: "#08120b", opacity: downloading ? 0.6 : 1 }}>
            {downloading ? "Rendering STL…" : "Download STL (full quality)"}
          </button>
          {preview.status === "error" && (
            <p className="mt-2 text-sm" style={{ color: "var(--error)" }}>Render error: {preview.error}</p>
          )}
        </div>

        <div className="h-[60vh] md:h-[calc(100vh-8rem)] sticky top-8">
          <StlViewer stl={preview.stl} quality="preview" loading={preview.status === "rendering"} />
        </div>
      </div>
    </main>
  );
}

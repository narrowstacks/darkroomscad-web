"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RenderClient } from "@/lib/openscad/client";
import { PreviewController, type PreviewState } from "@/lib/openscad/preview-controller";
import { useCarrierForm } from "@/hooks/use-carrier-form";
import { CarrierForm } from "@/components/CarrierForm";
import { ExportPanel } from "@/components/ExportPanel";
import { StlViewer } from "@/components/StlViewer";
import { ThemeToggle } from "@/components/ThemeToggle";

function newClient(): RenderClient {
  const worker = new Worker(new URL("../lib/openscad/worker.ts", import.meta.url), { type: "module" });
  return new RenderClient(worker);
}

export default function Home() {
  const { groups, values, setValue, toParams } = useCarrierForm();
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
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

  // Null the refs after disposing so a remount (React StrictMode dev double-invoke,
  // fast-refresh, route nav) re-creates a fresh worker + controller instead of
  // reusing the disposed ones (whose request()/worker are dead).
  useEffect(() => () => {
    ctlRef.current?.dispose();
    ctlRef.current = null;
    clientRef.current?.dispose();
    clientRef.current = null;
  }, []);

  function getClient(): RenderClient {
    return clientRef.current ?? (clientRef.current = newClient());
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">DarkroomSCAD</h1>
          <p style={{ color: "var(--text-muted)" }}>Configure your negative carrier and download a print-ready STL.</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(320px,420px)_1fr]">
        <div>
          <CarrierForm groups={groups} values={values} setValue={setValue} />
          <ExportPanel client={getClient} getParams={() => toParams({})} />
        </div>

        <div className="h-[60vh] md:h-[calc(100vh-8rem)] sticky top-8">
          <StlViewer stl={preview.stl} quality="preview" loading={preview.status === "rendering"} />
        </div>
      </div>
    </main>
  );
}

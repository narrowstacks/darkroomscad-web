"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RenderClient } from "@/lib/openscad/client";
import type { FormValue } from "@/lib/form/types";
import { PreviewController, type PreviewState } from "@/lib/openscad/preview-controller";
import { useCarrierForm } from "@/hooks/use-carrier-form";
import { usePresets } from "@/hooks/use-presets";
import { CarrierForm } from "@/components/CarrierForm";
import { ExportPanel } from "@/components/ExportPanel";
import { StlViewer } from "@/components/StlViewer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresetBar } from "@/components/PresetBar";

function newClient(): RenderClient {
  const worker = new Worker(new URL("../lib/openscad/worker.ts", import.meta.url), { type: "module" });
  return new RenderClient(worker);
}

export default function Home() {
  const { groups, values, setValue, applyValues, reset, toParams } = useCarrierForm();
  const { presets, save: savePreset, remove: deletePreset } = usePresets();
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });

  // A manual field edit means the config no longer matches the loaded preset —
  // clear the dropdown selection. Preset loads go through applyValues (not this).
  const editValue = useCallback((param: string, value: FormValue) => {
    setSelectedPresetId("");
    setValue(param, value);
  }, [setValue]);
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

  // Cover both the initial engine download ("idle" before the first render fires) and
  // every subsequent re-render, so the viewer never shows a bare canvas.
  const isLoading = preview.status === "rendering" || preview.status === "idle";

  return (
    <main className="flex flex-col p-4 md:h-screen md:overflow-hidden md:p-8">
      <header className="mb-6 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">DarkroomSCAD</h1>
          <p style={{ color: "var(--text-muted)" }}>Configure your negative carrier and download a print-ready STL.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PresetBar presets={presets} selectedId={selectedPresetId}
            onSelect={(id) => {
              setSelectedPresetId(id);
              const p = presets.find((x) => x.id === id);
              if (p) applyValues(p.values);
            }}
            onSave={(name) => setSelectedPresetId(savePreset(name, values).id)}
            onDelete={(id) => { deletePreset(id); if (id === selectedPresetId) setSelectedPresetId(""); }}
            onReset={() => { reset(); setSelectedPresetId(""); }} />
          <ThemeToggle />
        </div>
      </header>

      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(320px,400px)_1fr]">
        {/* Left column: export stays pinned near the top; the config form scrolls under it. */}
        <div className="flex flex-col gap-4 md:min-h-0">
          <section className="shrink-0 rounded-xl p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="mb-3 text-lg">Export</h2>
            <ExportPanel client={getClient} getParams={() => toParams({})} />
          </section>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <CarrierForm groups={groups} values={values} setValue={editValue} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          {preview.status === "error" && (
            <p className="mb-2 rounded px-3 py-2 text-sm"
              style={{ background: "var(--surface)", color: "var(--error)", border: "1px solid var(--border)" }}>
              Preview failed: {preview.error}
            </p>
          )}
          <div className="h-[60vh] min-h-0 md:h-auto md:flex-1">
            <StlViewer stl={preview.stl} quality="preview" loading={isLoading} />
          </div>
        </div>
      </div>
    </main>
  );
}

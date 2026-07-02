"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Aperture, TriangleAlert } from "lucide-react";
import { RenderClient } from "@/lib/openscad/client";
import type { RenderParams } from "@/lib/openscad/types";
import type { FormValue } from "@/lib/form/types";
import { PreviewController, type PreviewState } from "@/lib/openscad/preview-controller";
import { useCarrierForm } from "@/hooks/use-carrier-form";
import { usePresets } from "@/hooks/use-presets";
import { CarrierForm } from "@/components/CarrierForm";
import { CarrierView2D } from "@/components/CarrierView2D";
import { ExportPanel } from "@/components/ExportPanel";
import { StlViewer } from "@/components/StlViewer";
import { Segmented } from "@/components/controls/Segmented";
import { loadViewMode, saveViewMode, type ViewMode } from "@/lib/twod/view-mode";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PresetMenu } from "@/components/PresetMenu";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { download } from "@/lib/export/download";

function newClient(): RenderClient {
  const worker = new Worker(new URL("../lib/openscad/worker.ts", import.meta.url), { type: "module" });
  return new RenderClient(worker);
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}

// Split from `Home` so it can call `useToast()` — hooks resolve context from
// where they're rendered, and this component is nested inside `ToastProvider`
// (rendering `ToastProvider` from within `Home` itself would put `Home`
// outside its own provider's context).
function HomeContent() {
  const toast = useToast();
  const { groups, values, setValue, applyValues, reset, toParams, shareLink } = useCarrierForm();
  const { presets, save: savePreset, remove: deletePreset, importAll } = usePresets();
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });

  // 2D is the default so first paint is instant; restore the persisted choice
  // after mount (effect, not initializer) to avoid an SSR hydration mismatch.
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  useEffect(() => { setViewMode(loadViewMode()); }, []);
  const changeViewMode = useCallback((m: ViewMode) => {
    setViewMode(m);
    saveViewMode(m);
  }, []);

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

  // Request a 3D preview only once 3D is active — pure-2D sessions never spawn
  // the OpenSCAD worker, so there is no cold-load wait. `params` is memoized and
  // only changes when the carrier config changes, so guarding on its reference
  // means merely toggling 2D⇆3D never re-renders an unchanged carrier — only a
  // real config change (or the first switch into 3D) triggers a render.
  const params = useMemo(() => toParams({ Render_Quality: "preview" }), [toParams]);
  const renderedParamsRef = useRef<RenderParams | null>(null);
  useEffect(() => {
    if (viewMode !== "3d") return;
    if (renderedParamsRef.current === params) return;
    renderedParamsRef.current = params;
    controller().request(params);
  }, [params, viewMode]);

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

  const copyLink = useCallback(async () => {
    const link = shareLink();
    if (!link) {
      toast("Nothing to share yet — change a setting first");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied");
    } catch {
      toast("Couldn't copy");
    }
  }, [shareLink, toast]);

  return (
    <main className="relative z-10 flex flex-col p-4 md:h-screen md:overflow-hidden md:p-8">
      <header className="animate-fade-in relative z-50 mb-6 flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(var(--primary-rgb), 0.12)", border: "1px solid var(--border)", color: "var(--primary)" }}>
            <Aperture className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">DarkroomSCAD</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Configure a negative carrier and download a print-ready STL.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PresetMenu presets={presets} selectedId={selectedPresetId}
            onSelect={(id) => {
              setSelectedPresetId(id);
              const p = presets.find((x) => x.id === id);
              if (p) applyValues(p.values);
            }}
            onSave={(name) => setSelectedPresetId(savePreset(name, values).id)}
            onDelete={(id) => { deletePreset(id); if (id === selectedPresetId) setSelectedPresetId(""); }}
            onReset={() => { reset(); setSelectedPresetId(""); }}
            onExport={() => download("darkroomscad-presets.json", JSON.stringify(presets, null, 2), "application/json")}
            onImport={(text) => importAll(text)}
            onCopyLink={copyLink} />
          <ThemeToggle />
        </div>
      </header>

      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(320px,400px)_1fr]">
        {/* Left column: export stays pinned near the top; the config form scrolls under it. */}
        <div className="flex flex-col gap-4 md:min-h-0">
          <section className="panel shadow-subtle animate-slide-fade-bottom shrink-0 p-4">
            <h2 className="eyebrow mb-3">Export</h2>
            <ExportPanel client={getClient} getParams={() => toParams({})}
              presetName={presets.find((p) => p.id === selectedPresetId)?.name} />
          </section>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
            <CarrierForm groups={groups} values={values} setValue={editValue} />
          </div>
        </div>

        <div className="animate-fade-in flex min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-end">
            <Segmented label="" ariaLabel="View mode"
              options={[{ value: "2d", label: "2D" }, { value: "3d", label: "3D" }]}
              value={viewMode}
              onChange={(v) => changeViewMode(v === "3d" ? "3d" : "2d")} />
          </div>
          {viewMode === "3d" && preview.status === "error" && (
            <div className="mb-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "rgba(var(--primary-rgb), 0.04)", color: "var(--error)",
                border: "1px solid color-mix(in srgb, var(--error) 35%, transparent)" }}>
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span><span className="font-medium">Preview failed.</span> {preview.error}</span>
            </div>
          )}
          <div className="h-[60vh] min-h-0 md:h-auto md:flex-1">
            {viewMode === "2d"
              ? <CarrierView2D values={values} />
              : <StlViewer stl={preview.stl} quality="preview" loading={isLoading} />}
          </div>
        </div>
      </div>
    </main>
  );
}

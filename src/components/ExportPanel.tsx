"use client";
import { useState } from "react";
import { ChevronDown, Download, Loader2, Package, TriangleAlert } from "lucide-react";
import { renderParts, zipParts, type ExportProgress, type ExportedPart } from "@/lib/export/export-controller";
import { zipFileName } from "@/lib/export/zip-name";
import type { RenderParams } from "@/lib/openscad/types";
import type { RenderClient } from "@/lib/openscad/client";

function download(name: string, data: Uint8Array, type: string) {
  const blob = new Blob([new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function ExportPanel({ client, getParams, presetName }: {
  client: () => RenderClient;
  getParams: () => RenderParams;
  // Name of the loaded, unchanged preset (if any) — used in the ZIP filename.
  presetName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [individual, setIndividual] = useState(false);
  const [parts, setParts] = useState<ExportedPart[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<ExportedPart[] | null> {
    setBusy(true); setError(null); setParts([]);
    try {
      const form = getParams();
      const result = await renderParts(client(), form, setProgress);
      setParts(result.parts);
      return result.parts;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  async function handleZip() {
    const p = await run();
    if (!p || p.length === 0) return;
    const form = getParams();
    download(zipFileName(form, presetName), zipParts(p), "application/zip");
  }

  return (
    <div className="space-y-3">
      <button onClick={handleZip} disabled={busy} className="btn btn-primary w-full px-4 py-3">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            {progress ? `Rendering part ${progress.done} of ${progress.total}…` : "Rendering…"}
          </>
        ) : (
          <><Package className="size-4" /> Download set (ZIP)</>
        )}
      </button>

      <button onClick={() => setIndividual((v) => !v)} className="btn btn-ghost w-full justify-between px-2 py-1.5">
        <span>Download individual parts</span>
        <ChevronDown className="size-4 transition-transform" style={{ transform: individual ? "rotate(180deg)" : "none" }} />
      </button>

      {individual && (
        <div className="animate-scale-fade-in space-y-2">
          <button onClick={() => run()} disabled={busy} className="btn btn-secondary w-full px-3 py-2 text-sm">
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : null}
            {busy ? "Rendering…" : parts.length ? "Re-render parts" : "Render all parts"}
          </button>
          {parts.length > 0 && (
            <ul className="readout divide-y" style={{ borderColor: "var(--border)" }}>
              {parts.map((p) => (
                <li key={p.name} style={{ borderColor: "var(--border)" }} className="[&:not(:first-child)]:border-t">
                  <button onClick={() => download(p.name, p.stl, "model/stl")}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--surface-muted)]"
                    style={{ color: "var(--text-muted)" }}>
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text)" }}>{p.name}</span>
                    <span className="tabular-nums" style={{ color: "var(--text-dim)" }}>{fileSize(p.stl.length)}</span>
                    <Download className="size-4 shrink-0" style={{ color: "var(--primary)" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ color: "var(--error)", border: "1px solid color-mix(in srgb, var(--error) 35%, transparent)" }}>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span><span className="font-medium">Export failed.</span> {error}</span>
        </div>
      )}
    </div>
  );
}

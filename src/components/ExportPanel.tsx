"use client";
import { useState } from "react";
import { renderParts, zipParts, type ExportProgress, type ExportedPart } from "@/lib/export/export-controller";
import type { RenderParams } from "@/lib/openscad/types";
import type { RenderClient } from "@/lib/openscad/client";

function download(name: string, data: Uint8Array, type: string) {
  const blob = new Blob([new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ client, getParams }: {
  client: () => RenderClient;
  getParams: () => RenderParams;
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
    const zipName = `${String(form.Carrier_Type)}_${String(form.Film_Format)}_carrier-set.zip`.replace(/\s+/g, "-");
    download(zipName, zipParts(p), "application/zip");
  }

  return (
    <div className="space-y-2">
      <button onClick={handleZip} disabled={busy}
        className="w-full rounded px-4 py-2.5 font-medium"
        style={{ background: "var(--primary)", color: "#08120b", opacity: busy ? 0.6 : 1 }}>
        {busy ? (progress ? `Rendering ${progress.done}/${progress.total}…` : "Rendering…") : "Download set (ZIP)"}
      </button>

      <button onClick={() => setIndividual((v) => !v)} className="text-sm underline"
        style={{ color: "var(--secondary)" }}>
        {individual ? "Hide individual files" : "Download individual files"}
      </button>

      {individual && (
        <div className="space-y-1">
          <button onClick={() => run()} disabled={busy}
            className="w-full rounded px-3 py-1.5 text-sm"
            style={{ background: "var(--surface-muted)", color: "var(--text)", border: "1px solid var(--border)" }}>
            Render all parts
          </button>
          {parts.map((p) => (
            <button key={p.name} onClick={() => download(p.name, p.stl, "model/stl")}
              className="flex w-full items-center justify-between rounded px-3 py-1.5 text-sm"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
              <span>{p.name}</span><span style={{ color: "var(--primary)" }}>Download</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "var(--error)" }}>Export error: {error}</p>}
    </div>
  );
}

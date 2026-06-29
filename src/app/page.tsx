"use client";

import { useEffect, useRef, useState } from "react";
import { RenderClient } from "@/lib/openscad/client";
import { DEFAULT_FONT_FAMILY } from "@/config/fonts";

export default function Home() {
  const clientRef = useRef<RenderClient | null>(null);
  const [status, setStatus] = useState<string>("idle");

  useEffect(() => () => { clientRef.current?.dispose(); clientRef.current = null; }, []);

  function getClient(): RenderClient {
    if (!clientRef.current) {
      const worker = new Worker(new URL("../lib/openscad/worker.ts", import.meta.url), {
        type: "module",
      });
      clientRef.current = new RenderClient(worker);
    }
    return clientRef.current;
  }

  async function handleRender() {
    setStatus("rendering…");
    try {
      const result = await getClient().render({
        params: {
          Carrier_Type: "omega-d",
          Film_Format: "35mm",
          Orientation: "vertical",
          Top_or_Bottom: "bottom",
          Render_Quality: "final",
          Owner_Name: "DARKROOM",
          Fontface: DEFAULT_FONT_FAMILY,
        },
        quality: "final",
      });
      const blob = new Blob([new Uint8Array(result.stl)], { type: "model/stl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "omega-d_35mm_vertical_bottom.stl";
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`done in ${Math.round(result.durationMs)}ms`);
    } catch (err) {
      setStatus(`error: ${(err as Error).message}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">DarkroomSCAD Web — render core</h1>
      <button
        onClick={handleRender}
        disabled={status === "rendering…"}
        className="rounded bg-emerald-500 px-6 py-3 font-medium text-black hover:bg-emerald-400"
      >
        Render &amp; download default carrier
      </button>
      <p className="text-sm text-zinc-400">{status}</p>
    </main>
  );
}

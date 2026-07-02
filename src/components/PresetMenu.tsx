"use client";
import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, ChevronDown, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import type { Preset } from "@/lib/storage/presets-store";

export function PresetMenu({
  presets, selectedId, onSelect, onSave, onDelete, onReset, onExport, onImport,
}: {
  presets: Preset[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (raw: string) => { added: number; updated: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const selected = presets.find((p) => p.id === selectedId);
  const label = selected?.name ?? "Presets";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function openSave() {
    setName(selected?.name ?? "");
    setSaving(true);
    setOpen(false);
  }

  function commitSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existed = presets.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    onSave(trimmed);
    setSaving(false);
    setName("");
    toast(existed ? `Updated "${trimmed}"` : `Saved "${trimmed}"`);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    input.value = "";
    const outcome = onImport(text);
    if (!outcome) {
      toast("Couldn't read that presets file");
      return;
    }
    toast(`Imported ${outcome.added + outcome.updated} presets (${outcome.updated} updated)`);
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="nav-pill flex h-9 max-w-52 items-center gap-2 px-3.5 text-sm font-medium"
        style={{ color: "var(--text)" }} aria-haspopup="menu" aria-expanded={open}>
        <BookmarkPlus className="size-4 shrink-0" style={{ color: "var(--text-dim)" }} />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform" style={{ color: "var(--text-dim)",
          transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div role="menu" className="menu-surface animate-scale-fade-in absolute right-0 top-full z-50 mt-2 w-64 p-1.5">
          {presets.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {presets.map((p) => {
                const active = p.id === selectedId;
                return (
                  <div key={p.id} className="group flex items-center rounded-xl"
                    style={{ background: active ? "var(--surface-muted)" : "transparent" }}>
                    <button type="button" role="menuitem"
                      onClick={() => { onSelect(p.id); setOpen(false); }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm"
                      style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                      {active
                        ? <Check className="size-4 shrink-0" style={{ color: "var(--primary)" }} />
                        : <span className="size-4 shrink-0" />}
                      <span className="truncate font-medium">{p.name}</span>
                    </button>
                    <button type="button" onClick={() => onDelete(p.id)}
                      aria-label={`Delete preset ${p.name}`} title="Delete preset"
                      className="mr-1 rounded-lg p-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      style={{ color: "var(--text-dim)" }}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-3 text-center text-xs" style={{ color: "var(--text-dim)" }}>
              No saved presets yet. Save your current setup to reuse it later.
            </p>
          )}

          <div className="my-1 h-px" style={{ background: "var(--border)" }} />

          <button type="button" onClick={openSave}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
            style={{ color: "var(--text)" }}>
            <BookmarkPlus className="size-4 shrink-0" style={{ color: "var(--primary)" }} />
            Save current…
          </button>
          <button type="button" onClick={() => { onReset(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
            style={{ color: "var(--text-muted)" }}>
            <RotateCcw className="size-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            Reset to defaults
          </button>
          <button type="button" onClick={() => { onExport(); setOpen(false); }}
            disabled={presets.length === 0}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-40"
            style={{ color: "var(--text-muted)" }}>
            <Download className="size-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            Export presets…
          </button>
          <button type="button" onClick={() => { fileInputRef.current?.click(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
            style={{ color: "var(--text-muted)" }}>
            <Upload className="size-4 shrink-0" style={{ color: "var(--text-dim)" }} />
            Import presets…
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden"
        onChange={handleImportFile} />

      <Modal isOpen={saving} onClose={() => setSaving(false)} title="Save preset"
        footer={
          <>
            <button type="button" className="btn btn-secondary px-4 py-2" onClick={() => setSaving(false)}>Cancel</button>
            <button type="button" className="btn btn-primary px-4 py-2" disabled={!name.trim()} onClick={commitSave}>
              Save preset
            </button>
          </>
        }>
        <label htmlFor="preset-name" className="block text-sm font-medium" style={{ color: "var(--text)" }}>
          Preset name
        </label>
        <input id="preset-name" autoFocus value={name} placeholder="e.g. 35mm with name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitSave(); }}
          className="app-input mt-2" />
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          Saving a name that already exists overwrites that preset.
        </p>
      </Modal>
    </div>
  );
}

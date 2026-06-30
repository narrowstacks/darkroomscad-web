"use client";
import { useState } from "react";
import type { Preset } from "@/lib/storage/presets-store";

const btn = "rounded px-2 py-1 text-sm transition-colors focus-visible:outline-2";
const btnStyle = { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" } as const;

export function PresetBar({ presets, selectedId, onSelect, onSave, onDelete, onReset }: {
  presets: Preset[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const selected = presets.find((p) => p.id === selectedId);

  function commitSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setSaving(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <select aria-label="Load preset" value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded px-2 py-1 text-sm"
        style={{ background: "var(--surface-muted)", color: "var(--text)", border: "1px solid var(--border)" }}>
        <option value="">{presets.length ? "Load preset…" : "No presets yet"}</option>
        {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {selected && (
        <button type="button" onClick={() => onDelete(selected.id)}
          aria-label={`Delete preset ${selected.name}`} title="Delete preset"
          className={btn} style={btnStyle}>✕</button>
      )}

      {saving ? (
        <span className="flex items-center gap-1">
          <input autoFocus value={name} placeholder="Preset name"
            aria-label="Preset name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSave();
              if (e.key === "Escape") { setSaving(false); setName(""); }
            }}
            className="rounded px-2 py-1 text-sm"
            style={{ background: "var(--surface-muted)", color: "var(--text)", border: "1px solid var(--border)" }} />
          <button type="button" onClick={commitSave} className={btn}
            style={{ background: "var(--primary)", color: "#08120b", border: "1px solid var(--border)" }}>Save</button>
          <button type="button" onClick={() => { setSaving(false); setName(""); }}
            className={btn} style={btnStyle}>Cancel</button>
        </span>
      ) : (
        <button type="button" onClick={() => { setSaving(true); setName(selected?.name ?? ""); }}
          className={btn} style={btnStyle}>Save preset…</button>
      )}

      <button type="button" onClick={onReset}
        title="Reset to defaults" className={btn} style={btnStyle}>Reset</button>
    </div>
  );
}

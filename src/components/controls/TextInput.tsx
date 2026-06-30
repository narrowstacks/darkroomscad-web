"use client";
import { useEffect, useRef, useState } from "react";

// A text field that keeps keystrokes local and only commits to the form (which
// triggers a re-render/re-render of the preview) once the user is done typing —
// after a short pause or on blur/Enter. This keeps etch-text editing smooth
// instead of re-rendering the model on every keystroke.
export function TextInput({ id, label, value, onCommit, debounceMs = 500 }: {
  id: string;
  label: string;
  value: string;
  onCommit: (v: string) => void;
  debounceMs?: number;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt external changes (preset load / reset) — but never clobber what the
  // user is actively typing.
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  // Clear any pending debounce on unmount.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function commit(next: string) {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (next !== value) onCommit(next);
  }

  function handleChange(next: string) {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), debounceMs);
  }

  return (
    <div className="py-1">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: "var(--text)" }}>{label}</label>
      <input id={id} type="text" value={local}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => { focused.current = false; commit(local); }}
        onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
        className="mt-1 w-full rounded px-2 py-1.5 text-sm"
        style={{ background: "var(--surface-muted)", color: "var(--text)", border: "1px solid var(--border)" }} />
    </div>
  );
}

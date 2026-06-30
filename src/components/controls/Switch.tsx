"use client";

export function Switch({ checked, onChange, label, help, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" style={{ opacity: disabled ? 0.55 : 1 }}>
      <div>
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
        {help && <p className="text-xs" style={{ color: "var(--text-dim)" }}>{help}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 disabled:cursor-not-allowed"
        style={{ background: checked ? "var(--primary)" : "var(--surface-muted)", border: "1px solid var(--border)" }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
          style={{ left: checked ? "1.5rem" : "0.15rem", background: checked ? "#08120b" : "var(--text-muted)" }} />
      </button>
    </div>
  );
}

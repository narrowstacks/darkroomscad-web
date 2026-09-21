"use client";
import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

// Collapsible hardware + print recommendations, rendered in the Export panel
// under "Download individual parts" with the same ghost-button toggle.
const SECTIONS: { title: string; items: React.ReactNode[] }[] = [
  {
    title: "Screws",
    items: [
      <><strong>M2 × 4 mm socket-head cap screws</strong> (flat-topped cylindrical head, hex socket). These are the pegs when
      &ldquo;Heat-set&rdquo; pegs are selected: the thread bites into the bottom carrier and the head registers the top plate.</>,
      <>Keep <em>Screw head</em> on <strong>Socket</strong> unless you have something else in hand &mdash; the top hole is sized to the
      head style you pick.</>,
    ],
  },
  {
    title: "Print settings",
    items: [
      <><strong>0.2 mm</strong> layer height.</>,
      <><strong>100% infill</strong>, or at least <strong>5 solid bottom layers</strong> so the film-facing surface is dense and flat.</>,
      <><strong>Slow the first layer</strong> &mdash; the etched text and the opening edges are on it, and a clean first layer is what
      makes them crisp.</>,
    ],
  },
  {
    title: "Filament",
    items: [
      <><strong>Black PLA.</strong> Standard or matte both work.</>,
      <>For <strong>filed</strong> formats, prefer <strong>standard (non-matte)</strong> black: the slight sheen catches the enlarger
      light along the opening edge where there&rsquo;s empty space next to the film, giving the border a more natural
      &ldquo;sloppy filed&rdquo; look. Matte stays dead flat.</>,
    ],
  },
];

export function PrintGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost w-full justify-between px-2 py-1.5">
        <span className="flex items-center gap-2"><BookOpen className="size-4" /> Print guide</span>
        <ChevronDown className="size-4 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="animate-scale-fade-in space-y-4 rounded-xl border px-3 py-3 text-sm"
          style={{ borderColor: "var(--border)", background: "rgba(var(--bg-rgb), 0.35)", color: "var(--text-muted)" }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="mb-1.5 text-sm font-semibold" style={{ color: "var(--text)", fontFamily: "inherit" }}>{s.title}</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                {s.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

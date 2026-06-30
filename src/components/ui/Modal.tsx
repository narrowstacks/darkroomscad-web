"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// A small modal dialog rendered into a portal, with a blurred backdrop and a
// scale-fade entrance — matching the Dorkroom family modal. Escape and backdrop
// click both close it.
export function Modal({ isOpen, onClose, title, children, footer }: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (typeof document === "undefined" || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ height: "100dvh" }}>
      <button type="button" aria-hidden tabIndex={-1}
        className="absolute inset-0 cursor-default backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <dialog open aria-modal aria-label={title}
        className="menu-surface animate-scale-fade-in relative z-10 m-0 w-full max-w-md p-6"
        style={{ color: "var(--text)" }}>
        <button type="button" onClick={onClose} aria-label="Close"
          className="icon-button absolute right-4 top-4 size-8" style={{ borderColor: "transparent" }}>
          <X className="size-4" />
        </button>
        {title && <h2 className="mb-4 pr-8 text-lg font-semibold" style={{ color: "var(--text)" }}>{title}</h2>}
        <div className="space-y-4 text-sm" style={{ color: "var(--text-muted)" }}>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </dialog>
    </div>,
    document.body,
  );
}

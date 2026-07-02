"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormValue } from "@/lib/form/types";
import {
  loadPresets, savePresets, upsertPreset, deletePreset, parsePresets,
  sanitizePresetValues, mergePresets, type Preset,
} from "@/lib/storage/presets-store";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([]);

  // Load once on the client (localStorage isn't available during SSR).
  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const persist = useCallback((list: Preset[]) => {
    setPresets(list);
    savePresets(list);
  }, []);

  const save = useCallback((name: string, values: Record<string, FormValue>): Preset => {
    const list = upsertPreset(presets, name, values, newId());
    persist(list);
    // Return the resulting preset (the existing one if overwritten by name, else new).
    const trimmed = name.trim().toLowerCase();
    return list.find((p) => p.name.toLowerCase() === trimmed)!;
  }, [presets, persist]);

  const remove = useCallback((id: string) => {
    persist(deletePreset(presets, id));
  }, [presets, persist]);

  const importAll = useCallback((raw: string): { added: number; updated: number } | null => {
    const incoming = parsePresets(raw);
    if (incoming.length === 0) return null; // unparseable or empty — caller shows the error toast
    const cleaned = incoming.map((p) => ({ ...p, values: sanitizePresetValues(p.values) }));
    const { list, added, updated } = mergePresets(presets, cleaned, newId);
    persist(list);
    return { added, updated };
  }, [presets, persist]);

  return { presets, save, remove, importAll };
}

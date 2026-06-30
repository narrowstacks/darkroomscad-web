"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormValue } from "@/lib/form/types";
import {
  loadPresets, savePresets, upsertPreset, deletePreset, type Preset,
} from "@/lib/storage/presets-store";

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

  const save = useCallback((name: string, values: Record<string, FormValue>) => {
    persist(upsertPreset(presets, name, values, crypto.randomUUID()));
  }, [presets, persist]);

  const remove = useCallback((id: string) => {
    persist(deletePreset(presets, id));
  }, [presets, persist]);

  return { presets, save, remove };
}

import { safeGet, safeSet } from "@/lib/storage/local-storage";

export type ViewMode = "2d" | "3d";
export const VIEW_MODE_KEY = "darkroomscad-view-mode";

export function loadViewMode(): ViewMode {
  return safeGet(VIEW_MODE_KEY) === "3d" ? "3d" : "2d";
}

export function saveViewMode(m: ViewMode): void {
  safeSet(VIEW_MODE_KEY, m);
}

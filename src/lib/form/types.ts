export type ControlKind =
  | "select" | "number" | "text" | "toggle"
  | "segmented" | "switch" | "slider" | "cards";
export type FormValue = string | number | boolean;

export interface FieldConfig {
  param: string;
  label: string;
  help?: string;
  advanced?: boolean;
  control?: ControlKind;
  optionsFrom?: "fonts";
  optionVisual?: "carrier-outline";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  visibleWhen?: (values: Record<string, FormValue>) => boolean;
}

export interface GroupConfig {
  title: string;
  fields: FieldConfig[];
}

export interface ResolvedField {
  param: string;
  label: string;
  help?: string;
  advanced: boolean;
  control: ControlKind;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default: FormValue;
  optionVisual?: "carrier-outline";
  visibleWhen?: (values: Record<string, FormValue>) => boolean;
}

export interface ResolvedGroup {
  title: string;
  fields: ResolvedField[];
}

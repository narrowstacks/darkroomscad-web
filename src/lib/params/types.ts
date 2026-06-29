export type ParamType = "string" | "number" | "boolean" | "enum";

export interface ParamOption {
  value: string | number;
  label: string;
}

export interface Param {
  name: string;
  section: string;
  type: ParamType;
  default: string | number | boolean;
  options?: ParamOption[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  hidden: boolean;
}

export interface ParamSchema {
  params: Param[];
}

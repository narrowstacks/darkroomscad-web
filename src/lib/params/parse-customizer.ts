import type { Param, ParamOption, ParamSchema, ParamType } from "./types";

const SECTION_RE = /^\s*\/\*\s*\[(.+?)\]\s*\*\/\s*$/;
const LINE_COMMENT_RE = /^\s*\/\/\s?(.*)$/;
const ASSIGN_RE = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+?);\s*(?:\/\/\s*(.*))?$/;

function parseLiteral(raw: string): { type: ParamType; value: string | number | boolean } {
  const t = raw.trim();
  if (t === "true" || t === "false") return { type: "boolean", value: t === "true" };
  if (/^".*"$/.test(t)) return { type: "string", value: t.slice(1, -1) };
  const n = Number(t);
  if (!Number.isNaN(n) && t !== "") return { type: "number", value: n };
  // Fallback: treat as string (e.g. an expression default we won't expose)
  return { type: "string", value: t };
}

function parseOptions(annotation: string): ParamOption[] | null {
  const m = annotation.match(/^\[(.*)\]$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (inner === "") return null;
  // Range form: [min:max] or [min:step:max] — handled by caller, not here.
  if (/^-?\d*\.?\d+(\s*:\s*-?\d*\.?\d+){1,2}$/.test(inner)) return null;
  const parts = splitTopLevel(inner);
  return parts.map((p) => {
    const labelMatch = p.match(/^(.*?):(.*)$/);
    const rawVal = (labelMatch ? labelMatch[1] : p).trim();
    const lit = parseLiteral(rawVal);
    const value = lit.type === "number" ? (lit.value as number) : String(lit.value);
    const label = labelMatch ? labelMatch[2].trim() : String(value);
    return { value, label };
  });
}

function parseRange(annotation: string): { min: number; step?: number; max: number } | null {
  const m = annotation.match(/^\[\s*(-?\d*\.?\d+)\s*:\s*(-?\d*\.?\d+)\s*(?::\s*(-?\d*\.?\d+)\s*)?\]$/);
  if (!m) return null;
  if (m[3] !== undefined) return { min: Number(m[1]), step: Number(m[2]), max: Number(m[3]) };
  return { min: Number(m[1]), max: Number(m[2]) };
}

// Split a comma-separated list ignoring commas inside quotes.
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  for (const ch of s) {
    if (ch === '"') inStr = !inStr;
    if (ch === "," && !inStr) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

export function parseCustomizer(scad: string): ParamSchema {
  const lines = scad.split("\n");
  const params: Param[] = [];
  let section = "";
  let hidden = false;
  let pendingDescription: string | undefined;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      hidden = section.toLowerCase() === "hidden";
      pendingDescription = undefined;
      continue;
    }

    const assign = line.match(ASSIGN_RE);
    if (assign) {
      const [, name, rawValue, annotation] = assign;
      const lit = parseLiteral(rawValue);
      const param: Param = {
        name,
        section,
        type: lit.type,
        default: lit.value,
        hidden,
        description: pendingDescription,
      };
      if (annotation) {
        const ann = annotation.trim();
        const range = parseRange(ann);
        if (range) {
          param.type = "number";
          param.min = range.min;
          param.max = range.max;
          if (range.step !== undefined) param.step = range.step;
        } else {
          const options = parseOptions(ann);
          if (options) {
            const isBool =
              options.length === 2 &&
              options.every((o) => o.label === "true" || o.label === "false");
            if (!isBool && lit.type !== "boolean") {
              param.type = "enum";
              param.options = options;
            }
          }
        }
      }
      params.push(param);
      pendingDescription = undefined;
      continue;
    }

    const comment = line.match(LINE_COMMENT_RE);
    if (comment) {
      pendingDescription = comment[1].trim() || undefined;
      continue;
    }

    // Any other line (include/use/module/blank) clears a dangling description.
    if (line.trim() !== "") pendingDescription = undefined;
  }

  return { params };
}

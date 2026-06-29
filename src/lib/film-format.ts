export interface FormatChip {
  base: string;
  label: string;
  ratio: [number, number];
  hasFiled: boolean;
}

// Base formats shown as chips (the schema's "X filed" variants collapse into the
// `filed` toggle; "custom" is handled separately by the picker).
export const FORMAT_CHIPS: FormatChip[] = [
  { base: "35mm", label: "35mm", ratio: [3, 2], hasFiled: true },
  { base: "35mm full", label: "35mm full", ratio: [3, 2], hasFiled: false },
  { base: "half frame", label: "Half", ratio: [4, 3], hasFiled: false },
  { base: "6x4.5", label: "6×4.5", ratio: [4, 3], hasFiled: true },
  { base: "6x6", label: "6×6", ratio: [1, 1], hasFiled: true },
  { base: "6x7", label: "6×7", ratio: [5, 4], hasFiled: true },
  { base: "6x8", label: "6×8", ratio: [7, 5], hasFiled: true },
  { base: "6x9", label: "6×9", ratio: [3, 2], hasFiled: true },
  { base: "4x5", label: "4×5", ratio: [5, 4], hasFiled: false },
];

const FILED_SUFFIX = " filed";

export function toFilmFormatValue(base: string, filed: boolean): string {
  const chip = FORMAT_CHIPS.find((c) => c.base === base);
  return filed && chip?.hasFiled ? `${base}${FILED_SUFFIX}` : base;
}

export function fromFilmFormatValue(value: string): { base: string; filed: boolean } {
  if (value.endsWith(FILED_SUFFIX)) {
    return { base: value.slice(0, -FILED_SUFFIX.length), filed: true };
  }
  return { base: value, filed: false };
}

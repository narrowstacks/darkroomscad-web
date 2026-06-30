export interface FilmFormat { height: number; width: number; pegDistance: number; typeName: string; }

// Port of FILM_FORMATS in film-sizes.scad: [height, width, pegDistance, typeName].
export const FILM_FORMATS: Record<string, FilmFormat> = {
  "35mm":        { height: 37,   width: 24, pegDistance: 37,  typeName: "35MM" },
  "35mm filed":  { height: 40,   width: 28, pegDistance: 37,  typeName: "FILED35" },
  "35mm full":   { height: 36,   width: 24, pegDistance: 37,  typeName: "FULL35" },
  "half frame":  { height: 18,   width: 24, pegDistance: 37,  typeName: "HALF" },
  "6x4.5":       { height: 41.5, width: 56, pegDistance: 62,  typeName: "6x4.5" },
  "6x4.5 filed": { height: 43.5, width: 58, pegDistance: 62,  typeName: "F6x4.5" },
  "6x6":         { height: 56,   width: 56, pegDistance: 62,  typeName: "6x6" },
  "6x6 filed":   { height: 58,   width: 58, pegDistance: 62,  typeName: "F6x6" },
  "6x7":         { height: 70,   width: 56, pegDistance: 62,  typeName: "6x7" },
  "6x7 filed":   { height: 72,   width: 58, pegDistance: 62,  typeName: "F6x7" },
  "6x8":         { height: 77,   width: 56, pegDistance: 62,  typeName: "6x8" },
  "6x8 filed":   { height: 79,   width: 58, pegDistance: 62,  typeName: "F6x8" },
  "6x9":         { height: 84,   width: 56, pegDistance: 62,  typeName: "6x9" },
  "6x9 filed":   { height: 86,   width: 58, pegDistance: 62,  typeName: "F6x9" },
  "4x5":         { height: 120,  width: 95, pegDistance: 102, typeName: "4X5" },
};

const FILED = new Set([
  "35mm filed", "6x4.5 filed", "6x6 filed", "6x7 filed", "6x8 filed", "6x9 filed",
]);

export function isFiledFormat(format: string): boolean {
  return FILED.has(format);
}

export function filmTypeName(format: string): string {
  return FILM_FORMATS[format]?.typeName ?? (format === "custom" ? "CUSTOM" : format);
}

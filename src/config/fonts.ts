export interface BundledFont {
  id: string;
  family: string;
  file: string;
}

export const BUNDLED_FONTS: BundledFont[] = [
  { id: "liberation-mono", family: "Liberation Mono", file: "LiberationMono-Regular.ttf" },
  // Sans
  { id: "roboto", family: "Roboto", file: "Roboto-Regular.ttf" },
  { id: "open-sans", family: "Open Sans", file: "OpenSans-Regular.ttf" },
  { id: "inter", family: "Inter", file: "Inter-Regular.ttf" },
  { id: "montserrat", family: "Montserrat", file: "Montserrat-Regular.ttf" },
  { id: "lato", family: "Lato", file: "Lato-Regular.ttf" },
  { id: "oswald", family: "Oswald", file: "Oswald-Regular.ttf" },
  // Mono
  { id: "jetbrains-mono", family: "JetBrains Mono", file: "JetBrainsMono-Regular.ttf" },
  { id: "roboto-mono", family: "Roboto Mono", file: "RobotoMono-Regular.ttf" },
  { id: "space-mono", family: "Space Mono", file: "SpaceMono-Regular.ttf" },
  // Display / Serif
  { id: "bebas-neue", family: "Bebas Neue", file: "BebasNeue-Regular.ttf" },
  { id: "playfair-display", family: "Playfair Display", file: "PlayfairDisplay-Regular.ttf" },
];

// DarkroomSCAD ships Lucida Console (proprietary); remap to a bundled face.
export const DEFAULT_FONT_FAMILY = "Liberation Mono";

// Browser @font-face rules so the 2D SVG preview (and canvas text measurement)
// can render in the bundled families. Files live in public/fonts/.
export function bundledFontFaceCss(): string {
  return BUNDLED_FONTS
    .map((f) => `@font-face{font-family:"${f.family}";src:url("/fonts/${f.file}") format("truetype");font-display:swap;}`)
    .join("\n");
}

export interface BundledFont {
  id: string;
  family: string;
  file: string;
}

export const BUNDLED_FONTS: BundledFont[] = [
  { id: "liberation-mono", family: "Liberation Mono", file: "LiberationMono-Regular.ttf" },
];

// DarkroomSCAD ships Lucida Console (proprietary); remap to a bundled face.
export const DEFAULT_FONT_FAMILY = "Liberation Mono";

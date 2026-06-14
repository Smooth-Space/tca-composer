export type Format = "1:1" | "4:5" | "9:16";
export type Mode = "light" | "mixed" | "heavy";
export type Variant = "none" | "split" | "full";
export type SplitOrder = "image-first" | "title-first";

export const PLACEHOLDER_SRC = "/placeholder.jpg";

export interface Title {
  id: string;
  text: string;
}

export interface ImageItem {
  id: string;
  src: string;
}

export interface Composition {
  format: Format;
  variant: Variant;
  background: string;
  titleColor: string;
  textColor: string;
  titles: Title[];
  titleSizePx: number;
  titleMode: Mode;
  titleSeed: number;
  images: ImageItem[];
  splitOrder: SplitOrder;
  info: { text1: string; text2: string };
}

export const defaultComposition: Composition = {
  format: "1:1",
  variant: "none",
  background: "#FFFFFF",
  titleColor: "#000000",
  textColor: "#000000",
  titles: [{ id: "t1", text: "Title one" }],
  titleSizePx: 120,
  titleMode: "mixed",
  titleSeed: (Math.random() * 0xffffffff) >>> 0,
  images: [],
  splitOrder: "image-first",
  info: { text1: "Text 1", text2: "Text 2" },
};
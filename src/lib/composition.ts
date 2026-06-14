export type Format = "1:1" | "4:5" | "9:16";
export type Mode = "light" | "mixed" | "heavy";
export type Variant = "none" | "split" | "full" | "multi" | "inset";
export type SplitOrder = "image-first" | "title-first";
export type Template = "A" | "B" | "C";

export type CaptionKey = "text1" | "text2" | "text3" | "text4";

export interface CaptionSlot {
  key: CaptionKey;
  anchor: "top" | "bottom";
  column: "left" | "right";
  align: "left" | "right";
  label: string;
}

export const TEMPLATE_CAPTIONS: Record<Template, CaptionSlot[]> = {
  A: [
    { key: "text1", anchor: "bottom", column: "left", align: "left", label: "Text 1" },
    { key: "text2", anchor: "bottom", column: "right", align: "left", label: "Text 2" },
  ],
  B: [
    { key: "text1", anchor: "top", column: "right", align: "left", label: "Text 1 (top)" },
    { key: "text2", anchor: "bottom", column: "right", align: "left", label: "Text 2 (bottom)" },
  ],
  C: [
    { key: "text1", anchor: "top", column: "left", align: "left", label: "Text 1 (top-left)" },
    { key: "text2", anchor: "top", column: "right", align: "right", label: "Text 2 (top-right)" },
    { key: "text3", anchor: "bottom", column: "left", align: "left", label: "Text 3 (bottom-left)" },
    { key: "text4", anchor: "bottom", column: "right", align: "right", label: "Text 4 (bottom-right)" },
  ],
};

export const TEMPLATE_VARIANTS: Record<Template, Variant[]> = {
  A: ["none", "split", "full", "multi"],
  B: ["none", "inset", "full", "multi"],
  C: ["none", "split", "full", "multi"],
};

export const PLACEHOLDER_SRC = "/placeholder.jpg";

export interface Title {
  id: string;
  text: string;
}

export interface ImageItem {
  id: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface Composition {
  format: Format;
  template: Template;
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
  multiSeed: number;
  captions: { text1: string; text2: string; text3: string; text4: string };
}

export const defaultComposition: Composition = {
  format: "1:1",
  template: "A",
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
  multiSeed: (Math.random() * 0xffffffff) >>> 0,
  captions: { text1: "Text 1", text2: "Text 2", text3: "", text4: "" },
};
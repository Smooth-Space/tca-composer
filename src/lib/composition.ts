import lagunaGloriaAsset from "@/assets/laguna-gloria.jpg.asset.json";
import { newSeed } from "@/lib/engine";

export type Format = "1:1" | "4:5" | "9:16";
export type Mode = "light" | "mixed" | "heavy";
export type Variant = "none" | "split" | "full" | "multi";
export type SplitOrder = "image-first" | "title-first";
export type Template = "A" | "B" | "C" | "D";

export type CaptionKey = "text1" | "text2" | "text3" | "text4";

export interface CaptionSlot {
  key: CaptionKey;
  anchor: "top" | "bottom" | "middle";
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
    { key: "text1", anchor: "top", column: "left", align: "left", label: "Text 1 (top-left)" },
    { key: "text2", anchor: "top", column: "right", align: "right", label: "Text 2 (top-right)" },
    { key: "text3", anchor: "bottom", column: "left", align: "left", label: "Text 3 (bottom-left)" },
    { key: "text4", anchor: "bottom", column: "right", align: "right", label: "Text 4 (bottom-right)" },
  ],
  C: [
    { key: "text1", anchor: "top", column: "right", align: "left", label: "Text 1 (top)" },
    { key: "text2", anchor: "bottom", column: "right", align: "left", label: "Text 2 (bottom)" },
  ],
  D: [
    { key: "text1", anchor: "middle", column: "left", align: "left", label: "Text 1" },
    { key: "text2", anchor: "middle", column: "right", align: "right", label: "Text 2" },
  ],
};

export const TEMPLATE_VARIANTS: Record<Template, Variant[]> = {
  A: ["none", "split", "full", "multi"],
  B: ["none", "split", "full", "multi"],
  C: ["none", "split", "full", "multi"],
  D: ["none", "split", "full", "multi"],
};

export const PLACEHOLDER_SRC = lagunaGloriaAsset.url;

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
  titles: Title[];
  titleSizePx: number;
  titleSizeMode: "fixed" | "fit";
  titleMode: Mode;
  titleSeed: number;
  titleShift: boolean;
  titleShiftSeed: number;
  images: ImageItem[];
  splitOrder: SplitOrder;
  multiSeed: number;
  imageOverlay: number;
  captions: { text1: string; text2: string; text3: string; text4: string };
  captionColors: { text1: string; text2: string; text3: string; text4: string };
}

export const defaultComposition: Composition = {
  format: "1:1",
  template: "A",
  variant: "none",
  background: "#FFFFFF",
  titleColor: "#000000",
  titles: [{ id: "t1", text: "Title one" }],
  titleSizePx: 120,
  titleSizeMode: "fixed",
  titleMode: "mixed",
  titleSeed: (Math.random() * 0xffffffff) >>> 0,
  titleShift: false,
  titleShiftSeed: newSeed(),
  images: [],
  splitOrder: "image-first",
  multiSeed: (Math.random() * 0xffffffff) >>> 0,
  imageOverlay: 0.2,
  captions: { text1: "Text 1", text2: "Text 2", text3: "Text 3", text4: "Text 4" },
  captionColors: { text1: "#000000", text2: "#000000", text3: "#000000", text4: "#000000" },
};
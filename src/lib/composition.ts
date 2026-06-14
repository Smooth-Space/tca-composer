export type Format = "1:1" | "4:5" | "9:16";
export type TitleCase = "upper" | "sentence";
export type Mode = "light" | "mixed" | "heavy";

export interface Title {
  id: string;
  text: string;
  case: TitleCase;
}

export interface Composition {
  format: Format;
  background: string;
  textColor: string;
  titles: Title[];
  titleSizePx: number;
  titleMode: Mode;
  titleSeed: number;
  info: { text1: string; text2: string };
}

export const defaultComposition: Composition = {
  format: "1:1",
  background: "#FFFFFF",
  textColor: "#000000",
  titles: [{ id: "t1", text: "Title one", case: "upper" }],
  titleSizePx: 120,
  titleMode: "mixed",
  titleSeed: (Math.random() * 0xffffffff) >>> 0,
  info: { text1: "Text 1", text2: "Text 2" },
};
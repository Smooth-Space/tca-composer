export type Format = "1:1" | "4:5" | "9:16";
export type TitleCase = "upper" | "sentence";

export interface Title {
  id: string;
  text: string;
}

export interface Composition {
  format: Format;
  background: string;
  textColor: string;
  titles: Title[];
  titleCase: TitleCase;
  titleSizePx: number;
  info: { text1: string; text2: string };
}

export const defaultComposition: Composition = {
  format: "1:1",
  background: "#FFFFFF",
  textColor: "#000000",
  titles: [{ id: "t1", text: "Title one" }],
  titleCase: "upper",
  titleSizePx: 120,
  info: { text1: "Text 1", text2: "Text 2" },
};
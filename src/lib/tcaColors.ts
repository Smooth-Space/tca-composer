export type TcaScale = "yellow" | "red" | "gold" | "green" | "teal" | "blue" | "purple" | "gray";

export const TCA_SCALES: TcaScale[] = ["gray", "yellow", "red", "gold", "green", "teal", "blue", "purple"];

export const TCA: Record<TcaScale, string[]> = {
  yellow: ["#FFFDF9","#FFFBEC","#FEF8D3","#FDF6C5","#FBF2B8","#F7E797","#F4DA6A","#F2CE35","#F2C900","#917500","#423600","#221B00"],
  red:    ["#FFFBF8","#FFF5F1","#FFECE4","#FFD9D0","#FFD8C9","#FFCBB8","#FFB9A1","#FF9B7A","#E65929","#D0440B","#5A0F00","#370800"],
  gold:   ["#FFFCF7","#FFF7EF","#FFEFE0","#FFECC5","#FEDEC1","#FBD2AE","#F7C393","#F1A964","#F39009","#B25E00","#4D2100","#301100"],
  green:  ["#FDFDF8","#FAF9F1","#F4F3E4","#F2F6D0","#E9E6CA","#E1DDB9","#D6D1A2","#C5BD7B","#C9DB75","#6B8518","#212900","#201C00"],
  teal:   ["#F8FEFD","#F0FCF9","#E3F7F3","#D6F3ED","#C7EEE7","#B4E7DE","#9ADED2","#6ACFC0","#00CDB9","#008374","#003A32","#00231D"],
  blue:   ["#FBFDFF","#F5F9FF","#ECF2FF","#E3ECFF","#D9E4FF","#CCDBFF","#BBCEFC","#A1B9F7","#6784D7","#5470C1","#111B3A","#101934"],
  purple: ["#FFFBFE","#FDF7FB","#F9EEF7","#F2E6FA","#F2DDED","#ECD2E7","#E4C2DE","#D7AACF","#C588BB","#9B6192","#40233C","#261324"],
  gray:   ["#FDFBF7","#F8F5F0","#F2EDE7","#EBE6DF","#E4DFD7","#DBD6CD","#CFC9C0","#BAB3A9","#8D877E","#787269","#68645D","#23201B"],
};

// step is 1-based (01..12)
export const tcaColor = (scale: TcaScale, step: number) => TCA[scale][Math.min(12, Math.max(1, step)) - 1];

export const TOKEN_DARK = "#23201B";   // gray 12 — dark text token
export const TOKEN_LIGHT = "#FDFBF7";  // gray 01 — white text token

// the system's text rule: a background at steps 01–09 takes dark text, 10–12 takes white
export const contrastToken = (bgStep: number) => (bgStep <= 9 ? TOKEN_DARK : TOKEN_LIGHT);

const _lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrastRatio = (a: string, b: string) => {
  const L1 = _lum(a), L2 = _lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

export const isTcaScale = (v: unknown): v is TcaScale =>
  typeof v === "string" && (TCA_SCALES as string[]).includes(v);

export const clampStep = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(12, Math.max(1, v));
};

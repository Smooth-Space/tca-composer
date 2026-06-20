import { newSeed } from "@/lib/engine";
import { type TcaScale, isTcaScale, clampStep } from "@/lib/tcaColors";

export type Format = "1:1" | "4:5" | "9:16" | "3:2";
export type Mode = "light" | "mixed" | "heavy";
export type Variant = "none" | "split" | "full" | "multi";
export type SplitOrder = "image-first" | "title-first";
export type Template = "A" | "B" | "D" | "freeform";
export type SplitStyle = "half" | "span";

export type CaptionKey = "text1" | "text2" | "text3" | "text4";
export type Align = "left" | "center" | "right";
export type RowAnchor = "top" | "bottom" | "middle";

export type Captions = Record<CaptionKey, string>;
export type CaptionColors = Record<CaptionKey, string>;
export type CaptionFlags = Record<CaptionKey, boolean>;
export type CaptionAlign = Record<CaptionKey, Align>;
export type CaptionCounts = Record<RowAnchor, 1 | 2>;

export interface CaptionSlot {
  key: CaptionKey;
  anchor: RowAnchor;
  column: "left" | "right";
  align: Align; // seed/default only — rendering reads Composition.captionAlign
  label: string;
  descriptor?: string;
}

export const TEMPLATE_CAPTIONS: Record<Template, CaptionSlot[]> = {
  A: [
    { key: "text1", anchor: "top", column: "left", align: "left", label: "Text 1", descriptor: "top-left" },
    { key: "text2", anchor: "top", column: "right", align: "left", label: "Text 2", descriptor: "top-right" },
    { key: "text3", anchor: "bottom", column: "left", align: "left", label: "Text 3", descriptor: "bottom-left" },
    { key: "text4", anchor: "bottom", column: "right", align: "left", label: "Text 4", descriptor: "bottom-right" },
  ],
  B: [
    { key: "text1", anchor: "top", column: "left", align: "left", label: "Text 1", descriptor: "top-left" },
    { key: "text2", anchor: "top", column: "right", align: "right", label: "Text 2", descriptor: "top-right" },
    { key: "text3", anchor: "bottom", column: "left", align: "left", label: "Text 3", descriptor: "bottom-left" },
    { key: "text4", anchor: "bottom", column: "right", align: "right", label: "Text 4", descriptor: "bottom-right" },
  ],
  D: [
    { key: "text1", anchor: "middle", column: "left", align: "left", label: "Text 1" },
    { key: "text2", anchor: "middle", column: "right", align: "right", label: "Text 2" },
  ],
  freeform: [],
};

export const TEMPLATE_VARIANTS: Record<Template, Variant[]> = {
  A: ["none", "split", "full", "multi"],
  B: ["none", "split", "full", "multi"],
  D: ["none", "split", "full", "multi"],
  freeform: ["none"],
};

// The slots visible in a row, left-first, limited to the row's input count (1 or 2).
export function getRowSlots(
  slots: CaptionSlot[],
  anchor: RowAnchor,
  counts: CaptionCounts,
): CaptionSlot[] {
  const rowSlots = slots
    .filter((s) => s.anchor === anchor)
    .sort((a, b) => (a.column === b.column ? 0 : a.column === "left" ? -1 : 1));
  return rowSlots.slice(0, counts[anchor]);
}

// Slots that actually occupy space in a row: within the count, excluding hidden fields.
// A hidden field has no physical presence, so its sibling spans the full width.
export function getVisibleRowSlots(
  slots: CaptionSlot[],
  anchor: RowAnchor,
  counts: CaptionCounts,
  captionHidden: CaptionFlags,
): CaptionSlot[] {
  return getRowSlots(slots, anchor, counts).filter((s) => !captionHidden[s.key]);
}

// A row is "active" when at least one visible slot has non-empty, non-hidden text.
export function isRowActive(
  slots: CaptionSlot[],
  captions: Captions,
  captionHidden: CaptionFlags,
  counts: CaptionCounts,
  anchor: RowAnchor,
): boolean {
  return getRowSlots(slots, anchor, counts).some(
    (s) => !captionHidden[s.key] && (captions[s.key] ?? "").trim() !== "",
  );
}

export const PLACEHOLDER_COLOR = "#f9f9f9";

export type PaletteFormula = "mono" | "mixed";
export interface PaletteState {
  formula: PaletteFormula;
  hueA: TcaScale; // type hue (title/text); also the single hue in mono
  hueB: TcaScale; // field hue (background) — used only in "mixed"
  bgStep: number; // 1..12
  titleStep: number; // 1..12 on hueA
  textStep: number; // 1..12 on hueA
}

export const defaultPalette: PaletteState = {
  formula: "mono",
  hueA: "gray",
  hueB: "gray",
  bgStep: 1,
  titleStep: 12,
  textStep: 12,
};

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
  titleAmplitude: number | null;
  titlePhase: number | null;
  titleShift: boolean;
  titleShiftSeed: number;
  titleShiftAmount: number;
  images: ImageItem[];
  splitOrder: SplitOrder;
  splitStyle: SplitStyle;
  multiSeed: number;
  animate: boolean;
  animSeed: number;
  animPlaying: boolean;
  globeScale: number;
  imageOverlay: number;
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  captionAlign: CaptionAlign;
  captionCounts: CaptionCounts;
  palette: PaletteState;
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
  titleAmplitude: null,
  titlePhase: null,
  titleShift: false,
  titleShiftSeed: newSeed(),
  titleShiftAmount: 1,
  images: [],
  splitOrder: "image-first",
  splitStyle: "half",
  multiSeed: (Math.random() * 0xffffffff) >>> 0,
  animate: false,
  animSeed: newSeed(),
  animPlaying: true,
  globeScale: 1.0,
  imageOverlay: 0.2,
  captions: { text1: "Text 1", text2: "Text 2", text3: "Text 3", text4: "Text 4" },
  captionColors: { text1: "#000000", text2: "#000000", text3: "#000000", text4: "#000000" },
  captionHidden: { text1: false, text2: false, text3: false, text4: false },
  captionAlign: { text1: "left", text2: "right", text3: "left", text4: "right" },
  captionCounts: { top: 2, bottom: 2, middle: 2 },
  palette: { ...defaultPalette },
};

export function normalizeComposition(data: Partial<Composition> | undefined): Composition {
  const c = { ...defaultComposition, ...(data ?? {}) } as Composition;

  // migrate legacy template "C" → A (+ span split)
  if ((c.template as string) === "C") {
    c.template = "A";
    if (c.variant === "split") c.splitStyle = "span";
  }
  if (c.splitStyle !== "half" && c.splitStyle !== "span") c.splitStyle = "half";

  // seeds — must be finite numbers
  if (typeof c.titleSeed !== "number" || !Number.isFinite(c.titleSeed)) c.titleSeed = newSeed();
  if (typeof c.titleShiftSeed !== "number" || !Number.isFinite(c.titleShiftSeed))
    c.titleShiftSeed = newSeed();
  c.titleShiftAmount =
    typeof c.titleShiftAmount === "number" && Number.isFinite(c.titleShiftAmount)
      ? Math.min(1, Math.max(0, c.titleShiftAmount))
      : 1;
  if (typeof c.animSeed !== "number" || !Number.isFinite(c.animSeed)) c.animSeed = newSeed();
  if (typeof c.multiSeed !== "number" || !Number.isFinite(c.multiSeed)) c.multiSeed = newSeed();

  // booleans
  if (typeof c.titleShift !== "boolean") c.titleShift = false;
  if (typeof c.animate !== "boolean") c.animate = false;
  if (typeof c.animPlaying !== "boolean") c.animPlaying = true;

  // optional waveform overrides: number | null
  c.titleAmplitude = typeof c.titleAmplitude === "number" ? c.titleAmplitude : null;
  c.titlePhase = typeof c.titlePhase === "number" ? c.titlePhase : null;

  // enums / clamped numbers
  if (c.titleSizeMode !== "fixed" && c.titleSizeMode !== "fit") c.titleSizeMode = "fixed";
  c.globeScale =
    typeof c.globeScale === "number" && Number.isFinite(c.globeScale)
      ? Math.min(2, Math.max(1, c.globeScale))
      : 1;

  // titles: always a non-empty array; A/B/C/freeform use a single (possibly multi-line) field; D needs exactly 2
  if (!Array.isArray(c.titles) || c.titles.length === 0) {
    c.titles = [{ id: "t1", text: "" }];
  }
  if (c.template !== "D" && c.titles.length > 1) {
    c.titles = [{ id: c.titles[0].id, text: c.titles.map((t) => t.text).join("\n") }];
  }
  if (c.template === "D") {
    c.titles = [...c.titles];
    while (c.titles.length < 2) c.titles.push({ id: crypto.randomUUID(), text: "" });
    if (c.titles.length > 2) c.titles.length = 2;
  }

  // caption visibility flags
  c.captionHidden = {
    text1: c.captionHidden?.text1 === true,
    text2: c.captionHidden?.text2 === true,
    text3: c.captionHidden?.text3 === true,
    text4: c.captionHidden?.text4 === true,
  };

  // caption alignment — each must be left/center/right, else fall back to default
  const align = (c.captionAlign ?? {}) as Partial<CaptionAlign>;
  const validAlign = (v: unknown, fallback: Align): Align =>
    v === "left" || v === "center" || v === "right" ? v : fallback;
  c.captionAlign = {
    text1: validAlign(align.text1, "left"),
    text2: validAlign(align.text2, "right"),
    text3: validAlign(align.text3, "left"),
    text4: validAlign(align.text4, "right"),
  };

  // caption counts — clamp each row to 1 or 2 inputs
  const counts = (c.captionCounts ?? {}) as Partial<CaptionCounts>;
  const clampCount = (v: unknown): 1 | 2 => (v === 1 ? 1 : 2);
  c.captionCounts = {
    top: clampCount(counts.top),
    bottom: clampCount(counts.bottom),
    middle: clampCount(counts.middle),
  };

  // drop a legacy field that may exist in older saves
  delete (c as unknown as Record<string, unknown>).titleShiftOffsets;

  // palette state
  const p = (c.palette ?? {}) as Partial<PaletteState>;
  c.palette = {
    formula: p.formula === "mixed" ? "mixed" : "mono",
    hueA: isTcaScale(p.hueA) ? p.hueA : "gray",
    hueB: isTcaScale(p.hueB) ? p.hueB : "gray",
    bgStep: clampStep(p.bgStep ?? 1),
    titleStep: clampStep(p.titleStep ?? 12),
    textStep: clampStep(p.textStep ?? 12),
  };

  return c;
}

import { newSeed } from "@/lib/engine";
import { type TcaScale, isTcaScale } from "@/lib/tcaColors";
import {
  BG_ROLES,
  FG_ROLES,
  GRAY_BG_STEPS,
  legalChromaticFg,
  legalGrayFg,
  type ColorRole,
  type GrayStep,
} from "@/lib/palette";

export type Format = "1:1" | "4:5" | "9:16" | "3:2";
export type Mode = "light" | "mixed" | "heavy";
export type Variant = "none" | "split" | "full" | "multi";
export type SplitOrder = "image-first" | "title-first";
export type Template = "A" | "D" | "freeform";
export type SplitStyle = "half" | "half-inset" | "span";

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
  D: [
    { key: "text1", anchor: "middle", column: "left", align: "left", label: "Text 1" },
    { key: "text2", anchor: "middle", column: "right", align: "right", label: "Text 2" },
  ],
  freeform: [],
};

export const TEMPLATE_VARIANTS: Record<Template, Variant[]> = {
  A: ["none", "split", "full", "multi"],
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
  bgRole: ColorRole; // any of BG_ROLES (chromatic hues)
  titleRole: ColorRole; // any of FG_ROLES, must be legal for bgRole
  textRole: ColorRole; // any of FG_ROLES, must be legal for bgRole
  // Grayscale is a separate path (see palette.ts). These raw steps are used
  // instead of the roles above whenever the relevant hue is "gray".
  grayBgStep?: GrayStep;
  grayTitleStep?: GrayStep;
  grayTextStep?: GrayStep;
}

export const defaultPalette: PaletteState = {
  formula: "mono",
  hueA: "gray",
  hueB: "gray",
  bgRole: "light",
  titleRole: "dark",
  textRole: "dark",
  grayBgStep: 1,
  grayTitleStep: 12,
  grayTextStep: 12,
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
  // Template A / split / half / 3:2 only: center the title across the full canvas
  // width (spanning both halves) instead of confining it to the text column.
  // (Distinct from SplitStyle's "span" value.)
  titleSpanColumns: boolean;
  images: ImageItem[];
  splitOrder: SplitOrder;
  splitStyle: SplitStyle;
  multiSeed: number;
  animate: boolean;
  animSeed: number;
  animPlaying: boolean;
  globeScale: number;
  titleAnimate: boolean;
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
  // Deterministic default seed: module evaluation must produce identical markup on
  // server and client, or the SSR'd title axes mismatch the client's first render
  // (hydration error every load). Fresh randomness happens only on user reset.
  titleSeed: 0x1a2b3c4d,
  titleAmplitude: null,
  titlePhase: null,
  titleShift: false,
  titleSpanColumns: false,
  titleShiftSeed: newSeed(),
  titleShiftAmount: 1,
  images: [],
  splitOrder: "image-first",
  splitStyle: "half",
  // Deterministic default seed (see titleSeed) — keeps SSR/client first render identical.
  multiSeed: 0x5e6f7a8b,
  animate: false,
  animSeed: newSeed(),
  animPlaying: true,
  globeScale: 1.0,
  titleAnimate: false,
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
  // migrate legacy template "B" → A (split becomes half-inset)
  if ((c.template as string) === "B") {
    c.template = "A";
    if (c.variant === "split") c.splitStyle = "half-inset";
  }
  if (c.splitStyle !== "half" && c.splitStyle !== "half-inset" && c.splitStyle !== "span")
    c.splitStyle = "half";
  // "half-inset" isn't offered for Template A at 3:2 (side-by-side layout) — coerce
  // a stale value to "half" so state never holds an unselectable option.
  if (c.template === "A" && c.format === "3:2" && c.splitStyle === "half-inset")
    c.splitStyle = "half";

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
  if (typeof c.titleSpanColumns !== "boolean") c.titleSpanColumns = false;
  if (typeof c.animate !== "boolean") c.animate = false;
  if (typeof c.animPlaying !== "boolean") c.animPlaying = true;
  if (typeof c.titleAnimate !== "boolean") c.titleAnimate = false;
  // mutual exclusivity: title animation and template animation cannot both be on
  if (c.titleAnimate && c.animate) c.animate = false;

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

  // palette state — role-based. Legacy step-based saves have no role fields, so
  // they fall back to defaults (light bg + first legal fg). Foreground roles are
  // coerced to the first legal option when missing/illegal for the background.
  const p = (c.palette ?? {}) as Partial<PaletteState>;
  const formula: PaletteFormula = p.formula === "mixed" ? "mixed" : "mono";
  const hueA = isTcaScale(p.hueA) ? p.hueA : "gray";
  const hueB = isTcaScale(p.hueB) ? p.hueB : "gray";
  const bgRole: ColorRole = BG_ROLES.includes(p.bgRole as ColorRole)
    ? (p.bgRole as ColorRole)
    : "light";
  const grayBgStep: GrayStep = (GRAY_BG_STEPS as number[]).includes(p.grayBgStep as number)
    ? (p.grayBgStep as GrayStep)
    : 1;
  // Legality depends on formula + hues (mixed gray↔chromatic bridge), so compute
  // it from a preliminary palette. The legal* helpers don't read the fg fields,
  // so placeholders here are safe.
  const pre: PaletteState = {
    formula,
    hueA,
    hueB,
    bgRole,
    titleRole: "dark",
    textRole: "dark",
    grayBgStep,
    grayTitleStep: 12,
    grayTextStep: 12,
  };
  const chromFg = legalChromaticFg(pre);
  const grayFg = legalGrayFg(pre);
  const coerceFg = (r: unknown): ColorRole =>
    FG_ROLES.includes(r as ColorRole) && chromFg.includes(r as ColorRole)
      ? (r as ColorRole)
      : chromFg[0];
  const coerceGrayFg = (r: unknown): GrayStep => {
    const s: GrayStep = (GRAY_BG_STEPS as number[]).includes(r as number) ? (r as GrayStep) : 12;
    return grayFg.includes(s) ? s : (grayFg[0] ?? 12);
  };
  c.palette = {
    formula,
    hueA,
    hueB,
    bgRole,
    titleRole: coerceFg(p.titleRole),
    textRole: coerceFg(p.textRole),
    grayBgStep,
    grayTitleStep: coerceGrayFg(p.grayTitleStep),
    grayTextStep: coerceGrayFg(p.grayTextStep),
  };

  return c;
}

import { tcaColor, contrastRatio, type TcaScale } from "@/lib/tcaColors";
import type { PaletteState, Composition, CaptionColors } from "@/lib/composition";

export const CAPTION_SIZE_PX = 36;
export const TITLE_THRESHOLD = 3.0; // titles are display-sized → AA-large
export const TEXT_THRESHOLD = CAPTION_SIZE_PX >= 24 ? 3.0 : 4.5;

export interface ResolvedPalette {
  background: string;
  titleColor: string;
  textColor: string;
}

export function fieldHueOf(p: PaletteState): TcaScale {
  return p.formula === "mixed" ? p.hueB : p.hueA;
}
export function typeHueOf(p: PaletteState): TcaScale {
  return p.hueA;
}

export function resolvePalette(p: PaletteState): ResolvedPalette {
  return {
    background: tcaColor(fieldHueOf(p), p.bgStep),
    titleColor: tcaColor(typeHueOf(p), p.titleStep),
    textColor: tcaColor(typeHueOf(p), p.textStep),
  };
}

// Apply a palette to a composition's resolved fields (bg, title, all four captions).
export function applyPalette(comp: Composition, p: PaletteState): Partial<Composition> {
  const r = resolvePalette(p);
  const captionColors: CaptionColors = {
    text1: r.textColor,
    text2: r.textColor,
    text3: r.textColor,
    text4: r.textColor,
  };
  return {
    palette: p,
    background: r.background,
    titleColor: r.titleColor,
    captionColors,
  };
}

// A foreground step is selectable if it meets the threshold OR graphic mode is on.
export function isStepSelectable(
  p: PaletteState,
  step: number,
  threshold: number,
): boolean {
  if (p.graphic) return true;
  const bg = tcaColor(fieldHueOf(p), p.bgStep);
  const fg = tcaColor(typeHueOf(p), step);
  return contrastRatio(bg, fg) >= threshold;
}

export function stepContrast(p: PaletteState, step: number): number {
  const bg = tcaColor(fieldHueOf(p), p.bgStep);
  const fg = tcaColor(typeHueOf(p), step);
  return contrastRatio(bg, fg);
}

// Highest-contrast passing step on the type hue against the current background.
export function bestPassingStep(p: PaletteState, threshold: number): number {
  const bg = tcaColor(fieldHueOf(p), p.bgStep);
  let best = 1;
  let bestRatio = -1;
  for (let s = 1; s <= 12; s++) {
    const ratio = contrastRatio(bg, tcaColor(typeHueOf(p), s));
    if (ratio >= threshold && ratio > bestRatio) {
      bestRatio = ratio;
      best = s;
    }
  }
  // none passes → fall back to the absolute highest-contrast step
  if (bestRatio < 0) {
    for (let s = 1; s <= 12; s++) {
      const ratio = contrastRatio(bg, tcaColor(typeHueOf(p), s));
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = s;
      }
    }
  }
  return best;
}

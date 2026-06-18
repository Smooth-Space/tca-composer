export const TITLE_FONT = "'ABC Arizona Plus Variable'";
export const TITLE_LETTER_SPACING = "-0.05em";
export const TITLE_LINE_HEIGHT = 0.85;
export const CAPTION_FONT = "'ABC Arizona Plus Variable'";
export const CAPTION_SIZE_PX = 36;
export const CAPTION_LINE_HEIGHT = 1.1;
export const CAPTION_VARIATION = "'wght' 400, 'SRFF' 0, 'wdth' 100";

import { makeRng } from "@/lib/engine";

// Evenly-spread, seed-shuffled flush fractions (0..1) so lines reach toward both margins.
// Shared by TitleBlock (preview) and freeform SVG export so the two stay identical.
export function shiftOffsets(n: number, seed: number): number[] {
  if (n <= 1) return [0.5];
  const rng = makeRng(seed);
  const base = Array.from({ length: n }, (_, i) => i / (n - 1));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  const spacing = 1 / (n - 1);
  return base.map((v) => Math.min(1, Math.max(0, v + (rng() * 2 - 1) * spacing * 0.25)));
}
import { describe, expect, test } from "bun:test";
import { LETTER_SPACING_EM, LINE_HEIGHT } from "@/lib/freeformSvg";
import { TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT, shiftOffsets } from "@/lib/typo";

// Title text renders through two completely independent implementations:
//
//   CSS path        TitleBlock -> TitleLine, one <span> per character carrying
//                   font-variation-settings. Drives JPG and both MP4 exports.
//   Glyph-path      lib/freeformSvg.ts, fontkit glyph outlines with its own
//                   layout maths. Drives SVG export only.
//
// They share computeAxes and shiftOffsets and nothing else, so letter-spacing and
// line-height exist twice. When those copies drift the SVG export diverges from
// the canvas *silently* — no error, just a wrong file. These tests are the alarm.

const emToNumber = (v: string) => {
  const m = /^(-?[\d.]+)em$/.exec(v);
  if (!m) throw new Error(`expected an em value, got ${v}`);
  return Number(m[1]);
};

describe("letter-spacing agrees across both renderers", () => {
  test("TITLE_LETTER_SPACING is expressed in em", () => {
    expect(TITLE_LETTER_SPACING).toMatch(/^-?[\d.]+em$/);
  });

  test("CSS em value equals the glyph-path LETTER_SPACING_EM", () => {
    expect(emToNumber(TITLE_LETTER_SPACING)).toBe(LETTER_SPACING_EM);
  });
});

describe("line-height agrees across both renderers", () => {
  test("CSS TITLE_LINE_HEIGHT equals the glyph-path LINE_HEIGHT", () => {
    expect(TITLE_LINE_HEIGHT).toBe(LINE_HEIGHT);
  });

  test("both are unitless multipliers, not px", () => {
    expect(typeof TITLE_LINE_HEIGHT).toBe("number");
    expect(typeof LINE_HEIGHT).toBe("number");
  });
});

describe("shiftOffsets — genuinely shared by both paths", () => {
  test("is deterministic for a given seed", () => {
    expect(shiftOffsets(5, 99)).toEqual(shiftOffsets(5, 99));
  });

  test("returns one offset per line", () => {
    for (const n of [2, 3, 7, 12]) expect(shiftOffsets(n, 42)).toHaveLength(n);
  });

  test("a single line sits centred", () => {
    expect(shiftOffsets(1, 42)).toEqual([0.5]);
    expect(shiftOffsets(0, 42)).toEqual([0.5]);
  });

  test("every offset stays within the artboard", () => {
    for (const v of shiftOffsets(10, 7)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test("amount scales distance from centre, so 0 collapses to centred", () => {
    for (const v of shiftOffsets(6, 7, 0)) expect(v).toBeCloseTo(0.5, 10);
  });

  test("different seeds generally produce different arrangements", () => {
    expect(shiftOffsets(8, 1)).not.toEqual(shiftOffsets(8, 2));
  });
});

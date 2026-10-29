import { describe, expect, test } from "bun:test";
import {
  BG_ROLES,
  FG_ROLES,
  LEGAL_FG,
  TITLE_THRESHOLD,
  applyPalette,
  effectiveBgRole,
  firstLegalFg,
  firstLegalGrayFg,
  grayLegalFgSteps,
  isFgRoleLegal,
  isGrayFgLegal,
  resolveFgHex,
  resolveGrayHex,
  resolvePalette,
  type ColorRole,
  type GrayStep,
} from "@/lib/palette";
import { TCA_SCALES, contrastRatio, tcaColor, type TcaScale } from "@/lib/tcaColors";
import { defaultComposition, defaultPalette, type PaletteState } from "@/lib/composition";

const CHROMATIC: TcaScale[] = TCA_SCALES.filter((s) => s !== "gray");
const GRAY_STEPS: GrayStep[] = [1, 2, 12];

describe("the role model", () => {
  test("background offers all four roles", () => {
    expect([...BG_ROLES].sort()).toEqual(["brand", "dark", "light", "shade"]);
  });

  test("shade is never directly selectable as a foreground", () => {
    expect(FG_ROLES).not.toContain("shade");
    expect([...FG_ROLES].sort()).toEqual(["brand", "dark", "light"]);
  });

  test("every background has at least one legal foreground", () => {
    for (const bg of BG_ROLES) {
      expect(LEGAL_FG[bg].length).toBeGreaterThan(0);
      expect(isFgRoleLegal(bg, firstLegalFg(bg))).toBe(true);
    }
  });

  test("isFgRoleLegal matches the table exactly", () => {
    for (const bg of BG_ROLES) {
      for (const fg of BG_ROLES) {
        expect(isFgRoleLegal(bg, fg)).toBe(LEGAL_FG[bg].includes(fg));
      }
    }
  });

  test("an unknown background role is rejected rather than throwing", () => {
    expect(isFgRoleLegal("nonsense" as ColorRole, "dark")).toBe(false);
  });
});

describe("the Brand-on-Light substitution", () => {
  // The one substitution in the system: Brand foreground on a Light background
  // renders as Brand Shade. Invisible to the UI.
  test("brand on light resolves to shade (step 10), not brand (step 9)", () => {
    for (const hue of CHROMATIC) {
      expect(resolveFgHex(hue, "light", "brand")).toBe(tcaColor(hue, 10));
      expect(resolveFgHex(hue, "light", "brand")).not.toBe(tcaColor(hue, 9));
    }
  });

  test("it fires only on a light background", () => {
    for (const hue of CHROMATIC) {
      expect(resolveFgHex(hue, "dark", "brand")).toBe(tcaColor(hue, 9));
    }
  });

  test("other foreground roles are untouched on light", () => {
    for (const hue of CHROMATIC) {
      expect(resolveFgHex(hue, "light", "dark")).toBe(tcaColor(hue, 11));
    }
  });
});

describe("LEGAL_FG actually clears the contrast threshold", () => {
  // palette.ts calls this table "verified, so no live contrast check gates
  // selection". That claim is load-bearing — this executes it.
  for (const bg of BG_ROLES) {
    for (const fg of LEGAL_FG[bg]) {
      test(`${fg} on ${bg}, every hue`, () => {
        for (const hue of CHROMATIC) {
          const bgHex = tcaColor(hue, { light: 4, brand: 9, shade: 10, dark: 11 }[bg]);
          const ratio = contrastRatio(bgHex, resolveFgHex(hue, bg, fg));
          expect(ratio).toBeGreaterThanOrEqual(TITLE_THRESHOLD);
        }
      });
    }
  }
});

describe("grayscale is its own system", () => {
  test("only 1↔12 and 2↔12 pair; 1 and 2 never pair with each other", () => {
    expect(grayLegalFgSteps(1)).toEqual([12]);
    expect(grayLegalFgSteps(2)).toEqual([12]);
    expect([...grayLegalFgSteps(12)].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(isGrayFgLegal(1, 2)).toBe(false);
    expect(isGrayFgLegal(2, 1)).toBe(false);
  });

  test("the pairing is symmetric", () => {
    for (const bg of GRAY_STEPS) {
      for (const fg of GRAY_STEPS) {
        expect(isGrayFgLegal(bg, fg)).toBe(isGrayFgLegal(fg, bg));
      }
    }
  });

  test("firstLegalGrayFg returns something legal", () => {
    for (const bg of GRAY_STEPS) expect(isGrayFgLegal(bg, firstLegalGrayFg(bg))).toBe(true);
  });

  test("every legal gray pairing clears the threshold", () => {
    for (const bg of GRAY_STEPS) {
      for (const fg of grayLegalFgSteps(bg)) {
        expect(contrastRatio(resolveGrayHex(bg), resolveGrayHex(fg))).toBeGreaterThanOrEqual(
          TITLE_THRESHOLD,
        );
      }
    }
  });
});

describe("the gray↔chromatic bridge", () => {
  test("step 12 reads as dark, steps 1 and 2 read as light", () => {
    const p = (grayBgStep: GrayStep): PaletteState => ({
      ...defaultPalette,
      formula: "mixed",
      hueB: "gray",
      grayBgStep,
    });
    expect(effectiveBgRole(p(12))).toBe("dark");
    expect(effectiveBgRole(p(1))).toBe("light");
    expect(effectiveBgRole(p(2))).toBe("light");
  });

  test("a chromatic background reports its own role unchanged", () => {
    for (const bgRole of BG_ROLES) {
      expect(effectiveBgRole({ ...defaultPalette, hueA: "blue", bgRole })).toBe(bgRole);
    }
  });
});

describe("resolvePalette", () => {
  test("never renders type in the same colour as the field", () => {
    for (const hue of CHROMATIC) {
      for (const bgRole of BG_ROLES) {
        for (const titleRole of LEGAL_FG[bgRole]) {
          const r = resolvePalette({
            ...defaultPalette,
            formula: "mono",
            hueA: hue,
            hueB: hue,
            bgRole,
            titleRole,
            textRole: titleRole,
          });
          expect(r.titleColor).not.toBe(r.background);
          expect(r.textColor).not.toBe(r.background);
        }
      }
    }
  });

  test("always produces three hex colours", () => {
    const r = resolvePalette(defaultPalette);
    for (const v of [r.background, r.titleColor, r.textColor]) {
      expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("is pure — the same state resolves identically", () => {
    expect(resolvePalette(defaultPalette)).toEqual(resolvePalette(defaultPalette));
  });
});

describe("applyPalette", () => {
  test("drives all four captions from the single resolved text colour", () => {
    const patch = applyPalette(defaultComposition, defaultPalette);
    const { textColor } = resolvePalette(defaultPalette);
    expect(patch.captionColors).toEqual({
      text1: textColor,
      text2: textColor,
      text3: textColor,
      text4: textColor,
    });
  });

  test("carries the palette through alongside the derived colours", () => {
    const patch = applyPalette(defaultComposition, defaultPalette);
    expect(patch.palette).toEqual(defaultPalette);
    expect(patch.background).toBe(resolvePalette(defaultPalette).background);
    expect(patch.titleColor).toBe(resolvePalette(defaultPalette).titleColor);
  });
});

describe("defaultComposition derives its colours rather than hardcoding them", () => {
  // Regression guard for the Reset/New bug fixed in a740055.
  test("its colours match resolvePalette(defaultPalette)", () => {
    const r = resolvePalette(defaultComposition.palette);
    expect(defaultComposition.background).toBe(r.background);
    expect(defaultComposition.titleColor).toBe(r.titleColor);
  });
});

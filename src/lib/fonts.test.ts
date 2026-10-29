import { describe, expect, test } from "bun:test";
import { create } from "fontkit";
import { readFileSync, readdirSync } from "fs";
import { MODES } from "@/lib/engine";
import { CAPTION_FONT, TITLE_FONT } from "@/lib/typo";

// The trial font shipped for months without anyone noticing, partly because the
// .woff2 had no "-Trial" in its filename — only inside its name table. These
// tests read the actual font data rather than trusting filenames.
//
// fontkit cannot lay out woff2 (it throws on the cmap), but metadata reads fine,
// which is all this needs.

const FONT_DIR = "public/fonts";
const fontFiles = readdirSync(FONT_DIR).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f));
const open = (file: string) => create(readFileSync(`${FONT_DIR}/${file}`)) as never as FontMeta;

interface FontMeta {
  familyName: string;
  fullName: string;
  version: string;
  copyright: string;
  unitsPerEm: number;
  numGlyphs: number;
  variationAxes: Record<string, { min: number; default: number; max: number }>;
}

describe("no unlicensed fonts ship", () => {
  test("public/fonts is not empty", () => {
    expect(fontFiles.length).toBeGreaterThan(0);
  });

  for (const file of fontFiles) {
    test(`${file} carries no trial marker`, () => {
      const f = open(file);
      for (const field of [f.familyName, f.fullName, f.version]) {
        expect(field ?? "").not.toMatch(/trial/i);
        expect(field ?? "").not.toMatch(/unlicensed/i);
      }
    });
  }
});

describe("the variable font supports every axis the engine drives", () => {
  const variable = open("ABCArizonaSuperfamilyVariable.woff2");

  test("exposes wght, wdth, SRFF and slnt", () => {
    expect(Object.keys(variable.variationAxes).sort()).toEqual(["SRFF", "slnt", "wdth", "wght"]);
  });

  test("covers the wght and SRFF values every mode produces", () => {
    const { wght, SRFF } = variable.variationAxes;
    for (const cfg of Object.values(MODES)) {
      const span = (s: { kind: string; value?: number; start?: number; end?: number }) =>
        s.kind === "const" ? [s.value!, s.value!] : [s.start!, s.end!];
      for (const v of span(cfg.wght)) {
        expect(v).toBeGreaterThanOrEqual(wght.min);
        expect(v).toBeLessThanOrEqual(wght.max);
      }
      for (const v of span(cfg.SRFF)) {
        expect(v).toBeGreaterThanOrEqual(SRFF.min);
        expect(v).toBeLessThanOrEqual(SRFF.max);
      }
    }
  });

  test("covers the constant wdth 85 every mode uses", () => {
    const { wdth } = variable.variationAxes;
    for (const cfg of Object.values(MODES)) {
      expect(cfg.wdth).toBeGreaterThanOrEqual(wdth.min);
      expect(cfg.wdth).toBeLessThanOrEqual(wdth.max);
    }
  });

  test("reaches the designed italic at slnt -14", () => {
    expect(variable.variationAxes.slnt.min).toBeLessThanOrEqual(-14);
    expect(variable.variationAxes.slnt.max).toBeGreaterThanOrEqual(0);
  });
});

describe("the two variable formats are the same face", () => {
  // The CSS path loads the woff2; the SVG exporter fetches the ttf. If they ever
  // drift, SVG export silently stops matching the canvas.
  const woff2 = open("ABCArizonaSuperfamilyVariable.woff2");
  const ttf = open("ABCArizonaSuperfamilyVariable.ttf");

  test("same family, version and glyph count", () => {
    expect(ttf.familyName).toBe(woff2.familyName);
    expect(ttf.version).toBe(woff2.version);
    expect(ttf.numGlyphs).toBe(woff2.numGlyphs);
    expect(ttf.unitsPerEm).toBe(woff2.unitsPerEm);
  });

  test("same variation axes and ranges", () => {
    expect(ttf.variationAxes).toEqual(woff2.variationAxes);
  });
});

describe("css @font-face names match the constants that reference them", () => {
  const css = readFileSync("src/styles.css", "utf8");
  const declared = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );
  const unquote = (v: string) => v.replace(/^'|'$/g, "");

  test("styles.css declares both families", () => {
    expect(declared).toContain("ABC Arizona Superfamily Variable");
    expect(declared).toContain("ABC Arizona Sans");
  });

  test("TITLE_FONT and CAPTION_FONT resolve to declared families", () => {
    expect(declared).toContain(unquote(TITLE_FONT));
    expect(declared).toContain(unquote(CAPTION_FONT));
  });

  test("each declared family points at a file that exists", () => {
    const srcs = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    for (const s of srcs) expect(fontFiles).toContain(s);
  });
});

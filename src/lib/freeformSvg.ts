import { create, type Font } from "fontkit";
import { computeAxes, type Axes } from "@/lib/engine";
import { titleDisplay, applyItalic } from "@/lib/titleItalic";
import { shiftOffsets } from "@/lib/typo";
import type { Composition } from "@/lib/composition";

const FONT_URL = "/fonts/ABCArizonaPlusVariable-Trial.ttf";
// Exported solely so the renderer-parity test can assert these stay in step with
// TITLE_LETTER_SPACING / TITLE_LINE_HEIGHT in lib/typo.ts. This file deliberately
// keeps its own copies (glyph-path layout, not CSS) — the test is what stops the
// two renderers drifting apart silently.
export const LETTER_SPACING_EM = -0.05;
export const LINE_HEIGHT = 0.85;

let fontPromise: Promise<Font> | null = null;
async function loadFont() {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL)
      .then((r) => r.arrayBuffer())
      // create() is typed Font | FontCollection; the Arizona .ttf is a single
      // face, never a .ttc collection, so this narrows rather than guesses.
      .then((buf) => create(new Uint8Array(buf) as unknown as Buffer) as Font);
  }
  return fontPromise;
}

interface PlacedGlyph {
  d: string; // svg path in font units (y-up)
  x: number; // baseline x (px)
  baseline: number; // baseline y (px)
  scale: number; // units -> px
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

interface BuiltLine {
  glyphs: PlacedGlyph[];
  width: number;
}

// Lay out one line at fontSize S with per-glyph variation axes; x starts at 0.
function buildLine(
  font: Font,
  chars: string[],
  axes: Axes[],
  startIdx: number,
  fontSize: number,
  baseline: number,
): BuiltLine {
  const upm = font.unitsPerEm;
  const scale = fontSize / upm;
  const ls = fontSize * LETTER_SPACING_EM;
  let x = 0;
  const glyphs: PlacedGlyph[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const a = axes[startIdx + i];
    // slnt must be passed here AND in lineNaturalWidthFactor: fontkit shears the
    // outlines natively, and slanted glyphs are ~2% narrower, so omitting it in
    // either place desyncs SVG output from the canvas.
    const variation = a
      ? font.getVariation({ wght: a.wght, wdth: a.wdth, SRFF: a.SRFF, slnt: a.slnt })
      : font;
    const run = variation.layout(ch);
    let advUnits = 0;
    for (let g = 0; g < run.glyphs.length; g++) {
      const glyph = run.glyphs[g];
      const pos = run.positions[g];
      const d = glyph.path.toSVG();
      const bb = glyph.bbox;
      if (d && ch !== " ") {
        glyphs.push({
          d,
          x: x + (pos.xOffset || 0) * scale,
          baseline,
          scale,
          bbox: { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY },
        });
      }
      advUnits += pos.xAdvance;
    }
    x += advUnits * scale + ls;
  }
  return { glyphs, width: x - ls };
}

function lineNaturalWidthFactor(
  font: Font,
  chars: string[],
  axes: Axes[],
  startIdx: number,
): number {
  // width(S) = S * factor   (advances + letter-spacing both scale with S)
  const upm = font.unitsPerEm;
  let advUnits = 0;
  for (let i = 0; i < chars.length; i++) {
    const a = axes[startIdx + i];
    // slnt included deliberately — italic advances are narrower, and this drives
    // "fit" sizing. Dropping it here would size fit titles ~2% differently from
    // the DOM-measured canvas, visible only in SVG export.
    const variation = a
      ? font.getVariation({ wght: a.wght, wdth: a.wdth, SRFF: a.SRFF, slnt: a.slnt })
      : font;
    const run = variation.layout(chars[i]);
    for (let g = 0; g < run.positions.length; g++) advUnits += run.positions[g].xAdvance;
  }
  const n = chars.length;
  return advUnits / upm + LETTER_SPACING_EM * (n - 1);
}

/** One visual line: its characters plus where they start in the flat axis stream. */
interface VisualRow {
  chars: string[];
  startIdx: number;
}

/**
 * Recover the browser's ACTUAL line breaks from the rendered canvas.
 *
 * The CSS renderer soft-wraps at the container width; this glyph-path renderer has
 * no line-breaking of its own, so without this a wrapped title exported as one long
 * line. Rather than reimplement line-breaking in fontkit and hope it matches, read
 * the result: every character is its own span, so grouping spans by their vertical
 * position yields exactly the lines on screen.
 *
 * Returns null when the DOM isn't available or nothing matches, so the caller can
 * fall back to newline-splitting (the pre-existing behaviour).
 */
function readVisualRows(node: HTMLElement | null | undefined): VisualRow[] | null {
  if (!node) return null;
  // Scoped to data-title-rows so the hidden fit-measurement line and the empty-title
  // placeholder — which also contain character spans — are excluded.
  const spans = Array.from(node.querySelectorAll<HTMLElement>("[data-title-rows] [data-tchar]"));
  if (spans.length === 0) return null;

  const rows: VisualRow[] = [];
  let current: VisualRow | null = null;
  let lastTop = NaN;
  for (let i = 0; i < spans.length; i++) {
    const rect = spans[i].getBoundingClientRect();
    // Round to absorb sub-pixel jitter within a line; different lines differ by
    // roughly the line height, far above this threshold.
    const top = Math.round(rect.top);
    if (!current || Math.abs(top - lastTop) > 1) {
      current = { chars: [], startIdx: i };
      rows.push(current);
      lastTop = top;
    }
    current.chars.push(spans[i].textContent ?? "");
  }

  // A space sitting at a wrap point collapses to zero width in CSS and is not
  // painted; drawing it here would shift the line. Trim edges, keeping startIdx
  // aligned with however many leading characters were dropped.
  for (const row of rows) {
    while (row.chars.length && /^\s*$/.test(row.chars[0])) {
      row.chars.shift();
      row.startIdx++;
    }
    while (row.chars.length && /^\s*$/.test(row.chars[row.chars.length - 1])) {
      row.chars.pop();
    }
  }
  return rows.filter((r) => r.chars.length > 0);
}

export async function exportFreeformSVG(
  comp: Composition,
  areaWidth: number,
  node?: HTMLElement | null,
) {
  const font = await loadFont();
  // Same shared helper TitleBlock uses: strips inline-italic markup and applies
  // Mixed-mode uppercase (both display-only). Going through titleDisplay rather
  // than re-deriving rows/flat chars here is what keeps this glyph-path renderer
  // aligned with the CSS one.
  const rawText = comp.titles[0]?.text ?? "";
  const display = titleDisplay(rawText, comp.titleMode === "mixed");
  const rows = display.rows;
  const rowStart = display.rowStart;
  const axes = applyItalic(
    computeAxes(display.flatChars, comp.titleMode, comp.titleSeed, {
      amplitude: comp.titleAmplitude,
      phase: comp.titlePhase,
    }),
    display.flatItalic,
  );

  // Prefer the browser's real line breaks so soft-wrapped text exports exactly as
  // it looks on canvas. Falls back to newline-splitting when the DOM isn't there.
  const visualRows: VisualRow[] =
    readVisualRows(node) ??
    rows.map((text, r) => ({ chars: Array.from(text), startIdx: rowStart[r] }));

  // Shift and fit are still keyed off authored rows: fit is single-line-only by
  // design, and shift's offsets are seeded per authored line, not per wrapped line.
  const fitEnabled = comp.titleSizeMode === "fit" && rows.length === 1;
  const shiftEnabled = comp.titleShift && rows.length >= 2;
  const offsets = shiftOffsets(visualRows.length, comp.titleShiftSeed, comp.titleShiftAmount);

  const all: PlacedGlyph[] = [];

  for (let r = 0; r < visualRows.length; r++) {
    const { chars, startIdx } = visualRows[r];
    let fontSize = comp.titleSizePx;
    if (fitEnabled) {
      const factor = lineNaturalWidthFactor(font, chars, axes, startIdx);
      if (factor > 0) fontSize = areaWidth / factor;
    }
    const lineHeightPx = fontSize * LINE_HEIGHT;
    const baseline = r * lineHeightPx + fontSize * 0.8;
    const line = buildLine(font, chars, axes, startIdx, fontSize, baseline);

    // Must mirror TitleBlock: shift wins over alignment, and fit fills the width.
    let offsetX: number;
    if (fitEnabled) {
      offsetX = 0;
    } else if (shiftEnabled) {
      offsetX = offsets[r] * (areaWidth - line.width);
    } else if (comp.titleAlign === "left") {
      offsetX = 0;
    } else if (comp.titleAlign === "right") {
      offsetX = areaWidth - line.width;
    } else {
      offsetX = (areaWidth - line.width) / 2;
    }
    for (const g of line.glyphs) {
      g.x += offsetX;
      all.push(g);
    }
  }

  // Tight bounding box across all glyphs (px space) — hug on all four sides.
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const g of all) {
    const gx0 = g.x + g.bbox.minX * g.scale;
    const gx1 = g.x + g.bbox.maxX * g.scale;
    const gy0 = g.baseline - g.bbox.maxY * g.scale;
    const gy1 = g.baseline - g.bbox.minY * g.scale;
    if (gx0 < minX) minX = gx0;
    if (gx1 > maxX) maxX = gx1;
    if (gy0 < minY) minY = gy0;
    if (gy1 > maxY) maxY = gy1;
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
    maxY = comp.titleSizePx;
    minX = 0;
    maxX = areaWidth;
  }

  const vbX = minX;
  const vbY = minY;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const paths = all
    .map(
      (g) =>
        `<path d="${g.d}" fill="#000000" transform="translate(${g.x.toFixed(3)} ${g.baseline.toFixed(
          3,
        )}) scale(${g.scale.toFixed(6)} ${(-g.scale).toFixed(6)})"/>`,
    )
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vbW.toFixed(2)}" height="${vbH.toFixed(
      2,
    )}" viewBox="${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}">` +
    paths +
    `</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tca-freeform-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

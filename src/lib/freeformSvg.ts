import { create } from "fontkit";
import { computeAxes, makeRng } from "@/lib/engine";
import type { Composition } from "@/lib/composition";

const FONT_URL = "/fonts/ABCArizonaPlusVariable-Trial.ttf";
const LETTER_SPACING_EM = -0.05;
const LINE_HEIGHT = 0.85;

let fontPromise: Promise<any> | null = null;
async function loadFont() {
  if (!fontPromise) {
    fontPromise = fetch(FONT_URL)
      .then((r) => r.arrayBuffer())
      .then((buf) => create(new Uint8Array(buf) as unknown as Buffer));
  }
  return fontPromise;
}

// Mirror of TitleBlock.shiftOffsets so SVG layout matches the live preview.
function shiftOffsets(n: number, seed: number): number[] {
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
  font: any,
  chars: string[],
  axes: { wght: number; SRFF: number; wdth: number }[],
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
    const variation = a
      ? font.getVariation({ wght: a.wght, wdth: a.wdth, SRFF: a.SRFF })
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
  font: any,
  chars: string[],
  axes: { wght: number; SRFF: number; wdth: number }[],
  startIdx: number,
): number {
  // width(S) = S * factor   (advances + letter-spacing both scale with S)
  const upm = font.unitsPerEm;
  let advUnits = 0;
  for (let i = 0; i < chars.length; i++) {
    const a = axes[startIdx + i];
    const variation = a
      ? font.getVariation({ wght: a.wght, wdth: a.wdth, SRFF: a.SRFF })
      : font;
    const run = variation.layout(chars[i]);
    for (let g = 0; g < run.positions.length; g++) advUnits += run.positions[g].xAdvance;
  }
  const n = chars.length;
  return advUnits / upm + LETTER_SPACING_EM * (n - 1);
}

export async function exportFreeformSVG(comp: Composition, areaWidth: number) {
  const font = await loadFont();
  const text = comp.titles[0]?.text ?? "";
  const rows = text.split("\n");
  const flat = Array.from(text.replace(/\n/g, ""));
  const axes = computeAxes(flat, comp.titleMode, comp.titleSeed, {
    amplitude: comp.titleAmplitude,
    phase: comp.titlePhase,
  });

  // Start index of each row within the flat (newline-free) stream.
  const rowStart: number[] = [];
  let acc = 0;
  for (const r of rows) {
    rowStart.push(acc);
    acc += Array.from(r).length;
  }

  const fitEnabled = comp.titleSizeMode === "fit" && rows.length === 1;
  const shiftEnabled = comp.titleShift && rows.length >= 2;
  const offsets = shiftOffsets(rows.length, comp.titleShiftSeed);

  const all: PlacedGlyph[] = [];

  for (let r = 0; r < rows.length; r++) {
    const chars = Array.from(rows[r]);
    let fontSize = comp.titleSizePx;
    if (fitEnabled) {
      const factor = lineNaturalWidthFactor(font, chars, axes, rowStart[r]);
      if (factor > 0) fontSize = areaWidth / factor;
    }
    const lineHeightPx = fontSize * LINE_HEIGHT;
    const baseline = r * lineHeightPx + fontSize * 0.8;
    const line = buildLine(font, chars, axes, rowStart[r], fontSize, baseline);

    let offsetX: number;
    if (fitEnabled) {
      offsetX = 0;
    } else if (shiftEnabled) {
      offsetX = offsets[r] * (areaWidth - line.width);
    } else {
      offsetX = (areaWidth - line.width) / 2;
    }
    for (const g of line.glyphs) {
      g.x += offsetX;
      all.push(g);
    }
  }

  // Tight bounding box across all glyphs (px space).
  let minX = 0,
    maxX = areaWidth,
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
    `<rect x="${vbX.toFixed(2)}" y="${vbY.toFixed(2)}" width="${vbW.toFixed(2)}" height="${vbH.toFixed(
      2,
    )}" fill="#FFFFFF"/>` +
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
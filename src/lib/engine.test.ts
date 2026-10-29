import { describe, expect, test } from "bun:test";
import {
  MODES,
  UPRIGHT_SLNT,
  axesToCss,
  computeAxes,
  makeRng,
  resolveWave,
  type Axes,
  type Mode,
} from "@/lib/engine";

const MODE_LIST: Mode[] = ["light", "mixed", "heavy"];
const SAMPLE = [..."THE CONTEMPORARY AUSTIN"];
const SEED = 1234567;

describe("makeRng", () => {
  test("same seed yields an identical sequence", () => {
    const a = makeRng(SEED);
    const b = makeRng(SEED);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  test("different seeds diverge", () => {
    const a = Array.from({ length: 20 }, makeRng(1));
    const b = Array.from({ length: 20 }, makeRng(2));
    expect(a).not.toEqual(b);
  });

  test("stays within [0, 1)", () => {
    const rng = makeRng(SEED);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("computeAxes determinism", () => {
  // This is the SSR guard. Module evaluation has to produce identical markup on
  // server and client or hydration fails on every load, which is why the default
  // seeds in defaultComposition are hardcoded rather than newSeed().
  for (const mode of MODE_LIST) {
    test(`${mode}: repeated calls are byte-identical`, () => {
      expect(computeAxes(SAMPLE, mode, SEED)).toEqual(computeAxes(SAMPLE, mode, SEED));
    });

    test(`${mode}: the same seed resolves the same wave`, () => {
      expect(resolveWave(mode, SEED)).toEqual(resolveWave(mode, SEED));
    });
  }

  test("css strings round-trip identically for the same input", () => {
    const first = computeAxes(SAMPLE, "mixed", SEED).map(axesToCss);
    const second = computeAxes(SAMPLE, "mixed", SEED).map(axesToCss);
    expect(first.join("|")).toBe(second.join("|"));
  });
});

describe("brand invariants", () => {
  test("wdth is a constant 85 in every mode — intentional, not an oversight", () => {
    for (const mode of MODE_LIST) {
      expect(MODES[mode].wdth).toBe(85);
      for (const a of computeAxes(SAMPLE, mode, SEED)) expect(a.wdth).toBe(85);
    }
  });

  test("computeAxes never slants — italics are overlaid separately", () => {
    for (const mode of MODE_LIST) {
      for (const a of computeAxes(SAMPLE, mode, SEED)) expect(a.slnt).toBe(UPRIGHT_SLNT);
    }
  });

  test("only wght and SRFF vary across the stream", () => {
    const axes = computeAxes(SAMPLE, "mixed", SEED);
    expect(new Set(axes.map((a) => a.wdth)).size).toBe(1);
    expect(new Set(axes.map((a) => a.slnt)).size).toBe(1);
    expect(new Set(axes.map((a) => a.wght)).size).toBeGreaterThan(1);
  });
});

describe("rounding", () => {
  test("defaults to integers for static rendering", () => {
    for (const a of computeAxes(SAMPLE, "mixed", SEED)) {
      expect(Number.isInteger(a.wght)).toBe(true);
      expect(Number.isInteger(a.SRFF)).toBe(true);
    }
  });

  test("round:false keeps continuous floats so animation does not stair-step", () => {
    const axes = computeAxes(SAMPLE, "mixed", SEED, { round: false });
    expect(axes.some((a) => !Number.isInteger(a.wght))).toBe(true);
  });
});

describe("the character stream", () => {
  test("emits exactly one entry per character, spaces included", () => {
    expect(computeAxes(SAMPLE, "light", SEED)).toHaveLength(SAMPLE.length);
    expect(SAMPLE).toContain(" ");
  });

  test("handles the empty and single-character edges", () => {
    expect(computeAxes([], "light", SEED)).toEqual([]);
    expect(computeAxes(["A"], "light", SEED)).toHaveLength(1);
  });
});

describe("linear distribution: first and last land at opposite extremes", () => {
  // engine.ts documents this as holding "for every phase" — half a triangle cycle
  // from any point is always that point's complement. Recover the distribution
  // position from wght, which lerps 250..625 in mixed mode.
  const { start, end } = MODES.mixed.wght as { start: number; end: number };
  const dOf = (a: Axes) => (a.wght - start) / (end - start);

  for (const phase of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    test(`phase ${phase}`, () => {
      const axes = computeAxes(SAMPLE, "mixed", SEED, { phase, round: false });
      const sum = dOf(axes[0]) + dOf(axes[axes.length - 1]);
      expect(sum).toBeCloseTo(1, 10);
    });
  }

  test("no discontinuous jump anywhere along the stream", () => {
    const axes = computeAxes([...".".repeat(200)], "mixed", SEED, { phase: 0.9, round: false });
    const steps = axes.slice(1).map((a, i) => Math.abs(dOf(a) - dOf(axes[i])));
    const maxStep = Math.max(...steps);
    expect(maxStep).toBeLessThan(0.05);
  });
});

describe("axesToCss", () => {
  test("emits the exact font-variation-settings shape", () => {
    expect(axesToCss({ wght: 250, SRFF: 0, wdth: 85, slnt: 0 })).toBe(
      "'wght' 250, 'SRFF' 0, 'wdth' 85, 'slnt' 0",
    );
  });

  test("falls back to upright when slnt is absent", () => {
    const partial = { wght: 625, SRFF: 11, wdth: 85 } as unknown as Axes;
    expect(axesToCss(partial)).toBe("'wght' 625, 'SRFF' 11, 'wdth' 85, 'slnt' 0");
  });
});

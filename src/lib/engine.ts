export type Axes = { wght: number; SRFF: number; wdth: number; slnt: number };
export type Mode = "light" | "mixed" | "heavy";

// Slant is NOT part of the wave — computeAxes always emits UPRIGHT_SLNT. Italics
// are overlaid per character by the render paths (see lib/titleItalic.ts), which
// is why this axis has no entry in ModeConfig.
//
// -14 is the font's designed italic, not an approximation: all 75 named Italic
// instances in ABC Arizona Plus sit at exactly slnt -14 (the axis runs -14..0).
export const ITALIC_SLNT = -14;
export const UPRIGHT_SLNT = 0;

// Single source of truth for the font-variation-settings string, so the static
// React render and the live rAF DOM-writer produce byte-identical output.
export function axesToCss(a: Axes): string {
  return `'wght' ${a.wght}, 'SRFF' ${a.SRFF}, 'wdth' ${a.wdth}, 'slnt' ${a.slnt ?? UPRIGHT_SLNT}`;
}

type AxisSpec = { kind: "const"; value: number } | { kind: "lerp"; start: number; end: number };

interface ModeConfig {
  wdth: number; // constant 85 for all modes
  wght: AxisSpec;
  SRFF: AxisSpec;
  distribution: "sine" | "linear";
  amplitude: number | "random"; // 'random' => integer 1..4 (loops across the text)
  phase: number | "random"; // 'random' => float 0..1 (start offset of the loop)
}

export const MODES: Record<Mode, ModeConfig> = {
  light: {
    wdth: 85,
    wght: { kind: "const", value: 250 },
    SRFF: { kind: "lerp", start: 0, end: 65 },
    distribution: "sine",
    amplitude: "random",
    phase: "random",
  },
  mixed: {
    wdth: 85,
    wght: { kind: "lerp", start: 250, end: 625 },
    SRFF: { kind: "lerp", start: 65, end: 0 },
    distribution: "linear",
    amplitude: 1, // unchanged — fixed, never randomized, never exposed for Mixed
    phase: "random", // was 0 — now resolves a random phase like Light/Heavy do
  },
  heavy: {
    wdth: 85,
    wght: { kind: "const", value: 625 },
    SRFF: { kind: "lerp", start: 0, end: 11 },
    distribution: "sine",
    amplitude: "random",
    phase: "random",
  },
};

// Seeded RNG (mulberry32) so rerolls are reproducible from `seed`.
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function resolveRandoms(cfg: ModeConfig, rng: () => number) {
  const amplitude = cfg.amplitude === "random" ? 1 + Math.floor(rng() * 4) : cfg.amplitude;
  const phase = cfg.phase === "random" ? rng() : cfg.phase;
  return { amplitude, phase };
}

function distAt(
  cfg: ModeConfig,
  t: number,
  amplitude: number,
  phase: number,
  forceDistribution?: "sine" | "linear",
  forceAmplitude?: number,
) {
  const dist = forceDistribution ?? cfg.distribution;
  const amp = forceAmplitude ?? amplitude;
  // Linear distribution sweeps HALF a cycle of a triangle wave, offset by phase.
  // Half a triangle cycle from any point is always that point's complement, so the
  // last character always lands at the opposite extreme from the first — for every
  // phase. Being a triangle (not a sawtooth) there's no discontinuous jump anywhere,
  // including across the modulo wrap. Amplitude is unused here.
  if (dist === "linear") {
    const s = (phase + t * 0.5) % 1;
    return s < 0.5 ? s * 2 : (1 - s) * 2;
  }
  return (Math.sin(2 * Math.PI * (amp * t + phase)) + 1) / 2; // sine, 0..1
}

function axisValue(spec: AxisSpec, d: number) {
  return spec.kind === "const" ? spec.value : lerp(spec.start, spec.end, d);
}

export function resolveWave(mode: Mode, seed: number): { amplitude: number; phase: number } {
  const cfg = MODES[mode];
  const rng = makeRng(seed);
  return resolveRandoms(cfg, rng);
}

/**
 * chars = EVERY character across ALL title rows, in order (spaces included).
 * The distribution runs start->end across the whole stream, so position t is
 * each character's index over the total character count — never per-row.
 */
export function computeAxes(
  chars: string[],
  mode: Mode,
  seed: number,
  override?: {
    amplitude?: number | null;
    phase?: number | null;
    forceDistribution?: "sine" | "linear";
    forceAmplitude?: number;
    round?: boolean;
  },
): Axes[] {
  const cfg = MODES[mode];
  const base = resolveWave(mode, seed);
  const amplitude = override?.amplitude ?? base.amplitude;
  const phase = override?.phase ?? base.phase;
  // Static rendering rounds axes to integers (default). Animation passes
  // round:false so font-variation-settings interpolates as continuous floats,
  // avoiding visible stair-stepping during the slow loop.
  const round = override?.round ?? true;
  const q = (v: number) => (round ? Math.round(v) : v);
  const N = chars.length;
  return chars.map((_, i) => {
    const t = N > 1 ? i / (N - 1) : 0;
    const d = distAt(
      cfg,
      t,
      amplitude,
      phase,
      override?.forceDistribution,
      override?.forceAmplitude,
    );
    return {
      wght: q(axisValue(cfg.wght, d)),
      SRFF: q(axisValue(cfg.SRFF, d)),
      wdth: cfg.wdth,
      slnt: UPRIGHT_SLNT,
    };
  });
}

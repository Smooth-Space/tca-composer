export type Axes = { wght: number; SRFF: number; wdth: number };
export type Mode = "light" | "mixed" | "heavy";

type AxisSpec =
  | { kind: "const"; value: number }
  | { kind: "lerp"; start: number; end: number };

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
    amplitude: 1,
    phase: 0,
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

function distAt(cfg: ModeConfig, t: number, amplitude: number, phase: number) {
  if (cfg.distribution === "linear") return t;
  return (Math.sin(2 * Math.PI * (amplitude * t + phase)) + 1) / 2; // sine, 0..1
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
  override?: { amplitude?: number | null; phase?: number | null },
): Axes[] {
  const cfg = MODES[mode];
  const base = resolveWave(mode, seed);
  const amplitude = override?.amplitude ?? base.amplitude;
  const phase = override?.phase ?? base.phase;
  const N = chars.length;
  return chars.map((_, i) => {
    const t = N > 1 ? i / (N - 1) : 0;
    const d = distAt(cfg, t, amplitude, phase);
    return {
      wght: Math.round(axisValue(cfg.wght, d)),
      SRFF: Math.round(axisValue(cfg.SRFF, d)),
      wdth: cfg.wdth,
    };
  });
}
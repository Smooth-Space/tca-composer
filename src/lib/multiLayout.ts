export interface ImgAspect { id: string; naturalWidth: number; naturalHeight: number; }
export interface Placement { id: string; x: number; y: number; width: number; height: number; }

const P = {
  primaryLongEdge: 0.46,    // hero size (fraction of max(W,H))
  secondaryLongEdge: 0.28,  // supporting images
  sizeJitter: 0.06,
  edgeBleed: 0.15,          // max fraction of a box off-canvas
  minGapFrac: 0.02,         // min gap between images — no overlap
  posJitter: 0.10,          // vertical jitter within a zone
  maxBandFrac: 0.38,        // central clearance is random in [0, maxBandFrac*H] each reroll
};

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function sizeFor(im: ImgAspect, frac: number, longRef: number) {
  const box = frac * longRef;
  const ar = (im.naturalWidth && im.naturalHeight) ? im.naturalWidth / im.naturalHeight : 1;
  return ar >= 1 ? { w: box, h: box / ar } : { w: box * ar, h: box };
}
function szFrac(base: number, rng: () => number) {
  return base * (1 + (rng() * 2 - 1) * P.sizeJitter);
}
function clampCenter(cx: number, cy: number, w: number, h: number, W: number, H: number) {
  return {
    cx: clamp(cx, -w * P.edgeBleed + w / 2, W + w * P.edgeBleed - w / 2),
    cy: clamp(cy, -h * P.edgeBleed + h / 2, H + h * P.edgeBleed - h / 2),
  };
}
function separate(ps: Placement[], W: number, iterations = 6) {
  const gap = P.minGapFrac * W;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
        const bx = b.x + b.width / 2, by = b.y + b.height / 2;
        const ox = (a.width + b.width) / 2 + gap - Math.abs(ax - bx);
        const oy = (a.height + b.height) / 2 + gap - Math.abs(ay - by);
        if (ox > 0 && oy > 0) {
          if (ox < oy) { const push = (ox / 2) * (ax < bx ? -1 : 1); a.x += push; b.x -= push; }
          else { const push = (oy / 2) * (ay < by ? -1 : 1); a.y += push; b.y -= push; }
        }
      }
    }
  }
}

export function computeMultiLayout(
  images: ImgAspect[],
  W: number, H: number,
  titleRows: number, titleSizePx: number,   // kept for signature compatibility (unused now)
  seed: number,
  clearOverride?: number,                    // fraction of H; if set, fixes the band (Template D passes 0)
): Placement[] {
  const imgs = images.slice(0, 3);
  if (imgs.length === 0) return [];
  const rng = makeRng(seed);
  const longRef = Math.max(W, H);

  // Central clearance: fixed if overridden, otherwise RANDOM per reroll -> variable title overlap
  const bandH = (clearOverride !== undefined ? clearOverride : rng() * P.maxBandFrac) * H;
  const bandTop = (H - bandH) / 2;
  const bandBottom = bandTop + bandH;

  const hero = Math.floor(rng() * imgs.length);
  const others = imgs.map((_, i) => i).filter(i => i !== hero);
  const heroTop = rng() < 0.5;     // hero's zone
  const heroLeft = rng() < 0.5;    // hero's anchor edge

  const out: Placement[] = [];

  // HERO — alone in its zone, anchored to a left/right edge, vertically varied
  {
    const { w, h } = sizeFor(imgs[hero], szFrac(P.primaryLongEdge, rng), longRef);
    const zTop = heroTop ? 0 : bandBottom;
    const zBot = heroTop ? bandTop : H;
    const cx0 = heroLeft ? w * (0.5 - P.edgeBleed) : W - w * (0.5 - P.edgeBleed);
    const cy0 = lerp(zTop, zBot, 0.5) + (rng() * 2 - 1) * P.posJitter * (zBot - zTop);
    const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
    out.push({ id: imgs[hero].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  }

  // SECONDARIES — opposite zone, ALWAYS split left/right, at STAGGERED heights
  {
    const zTop = heroTop ? bandBottom : 0;
    const zBot = heroTop ? H : bandTop;
    const leftFirst = rng() < 0.5;
    const cols = leftFirst ? [0.20, 0.80] : [0.80, 0.20];
    const hts = leftFirst ? [0.32, 0.66] : [0.66, 0.32]; // staggered, paired to the side
    others.forEach((idx, k) => {
      const { w, h } = sizeFor(imgs[idx], szFrac(P.secondaryLongEdge, rng), longRef);
      const cx0 = cols[k] * W + (rng() * 2 - 1) * 0.04 * W;
      const cy0 = lerp(zTop, zBot, hts[k]) + (rng() * 2 - 1) * P.posJitter * (zBot - zTop);
      const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
      out.push({ id: imgs[idx].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    });
  }

  separate(out, W);
  return out;
}

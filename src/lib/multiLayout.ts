export interface ImgAspect { id: string; naturalWidth: number; naturalHeight: number; }
export interface Placement { id: string; x: number; y: number; width: number; height: number; }

const P = {
  primaryLongEdge: 0.50,    // hero size (fraction of max(W,H)) — bigger, stronger hierarchy
  secondaryLongEdge: 0.27,  // supporting images
  sizeJitter: 0.09,         // wider → more size variety between rerolls
  edgeBleed: 0.18,          // how far a box may run off-canvas (fraction of its own size)
  minGapFrac: 0.025,        // min gap between images (fraction of W) — no overlap
  posJitter: 0.10,          // vertical jitter within a zone
  titleClearFrac: 0.16,     // central clear band height (fraction of H). 0 = no safe area.
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
  const ar = im.naturalWidth / im.naturalHeight;
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
  titleRows: number, titleSizePx: number,
  seed: number,
  clearOverride?: number,   // when provided (incl. 0), replaces P.titleClearFrac
): Placement[] {
  const imgs = images.slice(0, 3);
  if (imgs.length === 0) return [];
  const rng = makeRng(seed);
  const longRef = Math.max(W, H);

  const clearFrac = clearOverride !== undefined ? clearOverride : P.titleClearFrac;
  const bandH = clearFrac * H;
  const bandTop = (H - bandH) / 2;
  const bandBottom = bandTop + bandH;

  const hero = Math.floor(rng() * imgs.length);
  const others = imgs.map((_, i) => i).filter(i => i !== hero);

  const heavyRight = rng() < 0.5;          // hero's horizontal side
  const heroTop = rng() < 0.5;             // hero's vertical side (which corner)
  const stackSecondaries = rng() < 0.5;    // both small on one side (asym) vs split L/R

  const out: Placement[] = [];

  // HERO — anchored into a corner, bleeding off the two edges of that corner
  {
    const { w, h } = sizeFor(imgs[hero], szFrac(P.primaryLongEdge, rng), longRef);
    const cx0 = heavyRight ? W - w * (0.5 - P.edgeBleed) : w * (0.5 - P.edgeBleed);
    const cy0 = heroTop ? h * (0.5 - P.edgeBleed) : H - h * (0.5 - P.edgeBleed);
    const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
    out.push({ id: imgs[hero].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  }

  // SECONDARIES — opposite vertical zone from the hero, staggered (not a level mirror)
  {
    const zTop = heroTop ? bandBottom : 0;
    const zBot = heroTop ? H : bandTop;
    others.forEach((idx, k) => {
      const { w, h } = sizeFor(imgs[idx], szFrac(P.secondaryLongEdge, rng), longRef);
      let cxFrac: number;
      if (stackSecondaries) {
        const side = heavyRight ? 0.24 : 0.76;          // lean opposite the hero's heavy side
        cxFrac = side + (k === 0 ? -0.06 : 0.10);
      } else {
        cxFrac = k === 0 ? 0.20 : 0.80;                 // split left / right
      }
      const cx0 = cxFrac * W + (rng() * 2 - 1) * 0.05 * W;
      const vt = k === 0 ? 0.30 : 0.68;                 // staggered heights
      const cy0 = lerp(zTop, zBot, vt) + (rng() * 2 - 1) * P.posJitter * (zBot - zTop);
      const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
      out.push({ id: imgs[idx].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    });
  }

  separate(out, W);
  return out;
}

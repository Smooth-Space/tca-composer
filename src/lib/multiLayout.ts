export interface ImgAspect {
  id: string;
  naturalWidth: number;
  naturalHeight: number;
}
export interface Placement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
} // canvas px, top-left

const P = {
  primaryLongEdge: 0.44, // fraction of max(W,H)
  secondaryLongEdge: 0.29,
  sizeJitter: 0.04,
  edgeBleed: 0.15, // max fraction of a box allowed off-canvas
  minGapFrac: 0.02, // min gap between boxes (fraction of W)
  posJitter: 0.12, // vertical jitter within a region (fraction of region height)
  bandMinFrac: 0.2, // central keep-clear band height, min (fraction of H)
  bandMaxFrac: 0.45,
  bandMargin: 0.02,
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

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// size a box to CONTAIN the native aspect within `frac * longRef`
function sizeFor(im: ImgAspect, frac: number, longRef: number) {
  const box = frac * longRef;
  const ar = im.naturalWidth / im.naturalHeight;
  return ar >= 1 ? { w: box, h: box / ar } : { w: box * ar, h: box };
}

// clamp a center so no more than edgeBleed of the box runs off-canvas
function clampCenter(cx: number, cy: number, w: number, h: number, W: number, H: number) {
  return {
    cx: clamp(cx, -w * P.edgeBleed + w / 2, W + w * P.edgeBleed - w / 2),
    cy: clamp(cy, -h * P.edgeBleed + h / 2, H + h * P.edgeBleed - h / 2),
  };
}

// a few iterations of pairwise push-apart so no two boxes overlap (with min gap)
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
  W: number,
  H: number,
  titleRows: number,
  titleSizePx: number,
  seed: number,
  bandHeightOverride?: number,
): Placement[] {
  const imgs = images.slice(0, 3);
  if (imgs.length === 0) return [];
  const rng = makeRng(seed);
  const longRef = Math.max(W, H);

  // central keep-clear band (scales with the title)
  const bandH = bandHeightOverride !== undefined
    ? bandHeightOverride
    : clamp(
        titleRows * titleSizePx * 0.9 + P.bandMargin * H,
        P.bandMinFrac * H,
        P.bandMaxFrac * H,
      );
  const bandTop = (H - bandH) / 2;
  const bandBottom = bandTop + bandH;
  const topMid = bandTop / 2;
  const botMid = bandBottom + (H - bandBottom) / 2;

  const primary = Math.floor(rng() * imgs.length);
  const others = imgs.map((_, i) => i).filter((i) => i !== primary);
  const primaryOnTop = rng() < 0.5;
  const primaryLeft = rng() < 0.5;

  const out: Placement[] = [];

  // Primary: alone in its region, anchored toward an edge
  {
    const { w, h } = sizeFor(
      imgs[primary],
      P.primaryLongEdge * (1 + (rng() * 2 - 1) * P.sizeJitter),
      longRef,
    );
    const rTop = primaryOnTop ? 0 : bandBottom;
    const rBot = primaryOnTop ? bandTop : H;
    const cx0 = primaryLeft ? W * 0.16 : W * 0.84;
    const cy0 = (primaryOnTop ? topMid : botMid) + (rng() * 2 - 1) * P.posJitter * (rBot - rTop);
    const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
    out.push({ id: imgs[primary].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  }

  // Secondaries: opposite region, split left & right columns
  {
    const rTop = primaryOnTop ? bandBottom : 0;
    const rBot = primaryOnTop ? H : bandTop;
    const mid = primaryOnTop ? botMid : topMid;
    const cols = shuffle([W * 0.2, W * 0.8], rng);
    others.forEach((idx, k) => {
      const { w, h } = sizeFor(
        imgs[idx],
        P.secondaryLongEdge * (1 + (rng() * 2 - 1) * P.sizeJitter),
        longRef,
      );
      const cx0 = (cols[k] ?? W * 0.5) + (rng() * 2 - 1) * 0.04 * W;
      const cy0 = mid + (rng() * 2 - 1) * P.posJitter * (rBot - rTop);
      const { cx, cy } = clampCenter(cx0, cy0, w, h, W, H);
      out.push({ id: imgs[idx].id, x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    });
  }

  separate(out, W);
  return out;
}
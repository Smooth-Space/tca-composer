import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ImageItem } from "@/lib/composition";
import type { AnimHandle } from "@/lib/anim";

const CYC_SEC = 1.6; // time per card; loop = N × CYC_SEC (tunable)
const GAP_PX = 8; // resting gap between cards, composition px (keep)
const AMP = 0.85; // featuring emphasis: 0 = constant flow, →1 = near-stop at each center (tunable)
const TAU = Math.PI * 2;

type Props = { images: ImageItem[]; imageOverlay: number; animSeed: number; playing: boolean };

export const SplitConveyor = forwardRef<AnimHandle, Props>(function SplitConveyor(
  { images, imageOverlay, animSeed, playing },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef(0);
  const exportingRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const drawRef = useRef<(t: number) => void>(() => {});

  useImperativeHandle(
    ref,
    () => ({
      durationSec: () => CYC_SEC * Math.max(images.length, 1),
      seekAndRender: (t) => drawRef.current(t),
      getCanvas: () => canvasRef.current,
      setExporting: (b) => {
        exportingRef.current = b;
      },
    }),
    [images.length],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    mount.appendChild(canvas);
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Image order = upload order; load + decode for crisp draws.
    const imgs = images.slice();
    const els = imgs.map((im) => {
      const e = new Image();
      e.src = im.src;
      return e;
    });
    Promise.all(els.map((e) => e.decode().catch(() => {}))).then(() =>
      drawRef.current(tRef.current),
    );

    const resize = () => {
      canvas.width = Math.round(mount.clientWidth * dpr);
      canvas.height = Math.round(mount.clientHeight * dpr);
      drawRef.current(tRef.current);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    drawRef.current = (t: number) => {
      const W = canvas.width,
        H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const N = els.length;
      if (N === 0) return;

      const gap = GAP_PX * dpr;

      // UNIFORM HEIGHT: every card fills the full band height; width follows native aspect.
      const dims = imgs.map((im) => {
        const ar = im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
        const ch = H; // fill container height (same for all)
        return { cw: ch * ar, ch };
      });

      // Single image: center it, no motion.
      if (N === 1) {
        const { cw, ch } = dims[0];
        const left = (W - cw) / 2,
          top = (H - ch) / 2;
        if (els[0].complete && els[0].naturalWidth > 0) ctx.drawImage(els[0], left, top, cw, ch);
        if (imageOverlay > 0) {
          ctx.globalAlpha = imageOverlay;
          ctx.fillStyle = "#000";
          ctx.fillRect(left, top, cw, ch);
          ctx.globalAlpha = 1;
        }
        return;
      }

      // One set: centers + total length (gap after each card).
      const Cset: number[] = [];
      let cur = 0;
      for (let i = 0; i < N; i++) {
        Cset[i] = cur + dims[i].cw / 2;
        cur += dims[i].cw + gap;
      }
      const setLen = cur;

      // FLUID MODULATED ADVANCE: continuous card index `a` advances N over the loop,
      // slowing as it passes each integer (card centered) and flowing faster between.
      const cyc = CYC_SEC,
        total = N * cyc;
      const tt = ((t % total) + total) % total;
      const a = tt / cyc - (AMP / TAU) * Math.sin((TAU * tt) / cyc);

      // centerline(a): interpolate cumulative card centers (wrap by setLen)
      const k = Math.floor(a),
        fr = a - k;
      const Ck = Cset[((k % N) + N) % N] + Math.floor(k / N) * setLen;
      const Cn = Cset[(((k + 1) % N) + N) % N] + Math.floor((k + 1) / N) * setLen;
      const shift = W / 2 - (Ck + (Cn - Ck) * fr);

      // Rigid strip, repeated to overfill the band → recycle happens OFF-SCREEN (no pop).
      const maxCardW = Math.max(...dims.map((d) => d.cw));
      const firstCopy = Math.floor((-shift - maxCardW) / setLen) - 1;
      const lastCopy = Math.floor((-shift + W + maxCardW) / setLen) + 1;
      const draws: { i: number; sx: number }[] = [];
      for (let c = firstCopy; c <= lastCopy; c++) {
        for (let i = 0; i < N; i++) {
          const sx = Cset[i] + c * setLen + shift;
          if (sx < -maxCardW || sx > W + maxCardW) continue;
          draws.push({ i, sx });
        }
      }
      draws.sort((p, q) => Math.abs(q.sx - W / 2) - Math.abs(p.sx - W / 2)); // centered card on top

      for (const { i, sx } of draws) {
        const { cw, ch } = dims[i];
        const left = sx - cw / 2,
          top = (H - ch) / 2;
        if (left + cw < 0 || left > W) continue;
        const el = els[i];
        if (el.complete && el.naturalWidth > 0) ctx.drawImage(el, left, top, cw, ch);
        if (imageOverlay > 0) {
          ctx.globalAlpha = imageOverlay;
          ctx.fillStyle = "#000";
          ctx.fillRect(left, top, cw, ch);
          ctx.globalAlpha = 1;
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!exportingRef.current && playingRef.current) {
        tRef.current = tRef.current + dt;
        drawRef.current(tRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      drawRef.current = () => {};
      canvasRef.current = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [images, imageOverlay]);

  return <div ref={mountRef} data-anim="true" style={{ position: "absolute", inset: 0 }} />;
});
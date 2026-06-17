import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ImageItem } from "@/lib/composition";
import type { AnimHandle } from "@/lib/anim";

const HOLD_SEC = 1.5; // pause with a card centered (tunable)
const EASE_SEC = 1.0; // slide to the next card (tunable)
const SLOT_FRAC = 0.6; // card-center spacing ÷ band width; <1 → neighbors peek, cropped by edges (tunable)
const CARD_H_FRAC = 0.7; // card box height ÷ band height (tunable)
const BOX_W_FRAC = 0.9; // card box width ÷ slot → small gap at rest, no overlap (tunable)
const SPREAD = 0.35; // extra spacing at peak velocity → gaps widen on the move, narrow at rest (tunable)

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
      durationSec: () => (HOLD_SEC + EASE_SEC) * Math.max(images.length, 1),
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

    const easeInOut = (e: number) =>
      e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2; // power3.inOut

    drawRef.current = (t: number) => {
      const W = canvas.width,
        H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const N = els.length;
      if (N === 0) return;

      const cycle = HOLD_SEC + EASE_SEC;
      const total = N * cycle; // full seamless loop
      const tt = ((t % total) + total) % total;
      const k = Math.floor(tt / cycle);
      const local = tt - k * cycle;

      let adv: number, vNorm: number;
      if (local < HOLD_SEC) {
        adv = k; // holding: card k centered, gaps at rest
        vNorm = 0;
      } else {
        const e = (local - HOLD_SEC) / EASE_SEC;
        adv = k + easeInOut(e); // sliding k -> k+1
        vNorm = Math.sin(Math.PI * e); // speed profile: 0 at ends, 1 mid-slide
      }

      const SLOT = SLOT_FRAC * W;
      const factor = 1 + SPREAD * vNorm; // gaps expand around screen center while moving
      const boxH = CARD_H_FRAC * H;

      // nearest wrapped copy of each card, in slot units; draw far→near so the centered card is on top
      const items = els
        .map((_, i) => {
          let o = (((i - adv) % N) + N) % N;
          if (o > N / 2) o -= N;
          return { i, o };
        })
        .sort((a, b) => Math.abs(b.o) - Math.abs(a.o));

      for (const { i, o } of items) {
        const im = imgs[i];
        const ar =
          im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
        let cw = SLOT * BOX_W_FRAC,
          ch = cw / ar; // contain native aspect in the card box
        if (ch > boxH) {
          ch = boxH;
          cw = ch * ar;
        }
        const cx = W / 2 + o * SLOT * factor; // peeking position, breathing with velocity
        const left = cx - cw / 2,
          top = (H - ch) / 2;
        if (left + cw < 0 || left > W) continue; // fully off-screen → skip (edges crop the rest)
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
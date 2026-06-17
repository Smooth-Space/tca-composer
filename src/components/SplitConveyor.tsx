import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ImageItem } from "@/lib/composition";
import type { AnimHandle } from "@/lib/anim";
import { makeRng } from "@/lib/engine";

const LOOP_SEC = 8; // seamless loop length (tunable; calm, globe-family tempo)
const CARD_H_FRAC = 0.72; // card height ÷ band height (tunable)
const TIGHTEN = 2.2; // >1 tightens spacing toward the right (tunable)
const LATENCY = 0.06; // subtle inner lag amount (tunable)

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
      durationSec: () => LOOP_SEC,
      seekAndRender: (t) => drawRef.current(t),
      getCanvas: () => canvasRef.current,
      setExporting: (b) => {
        exportingRef.current = b;
      },
    }),
    [],
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

    // Seeded image order (reroll changes arrangement); load + decode for crisp draws.
    const rng = makeRng(animSeed);
    const order0 = images.map((_, i) => i).sort(() => rng() - 0.5);
    const imgs = order0.map((i) => images[i]);
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

    const easeTighten = (p: number) => 1 - Math.pow(1 - p, TIGHTEN); // dense/tight on the right

    drawRef.current = (t: number) => {
      const W = canvas.width,
        H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const N = els.length;
      if (N === 0) return;
      const u = (((t / LOOP_SEC) % 1) + 1) % 1;
      const cardH = CARD_H_FRAC * H;
      const yTop = (H - cardH) / 2;
      const idx = els
        .map((_, i) => i)
        .sort((a, b) => ((a / N + u) % 1) - ((b / N + u) % 1)); // ascending p → right cards on top
      for (const i of idx) {
        const el = els[i];
        const im = imgs[i];
        const ar =
          im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
        const cardW = cardH * ar;
        const p = (i / N + u) % 1;
        const xC = -cardW + (W + 2 * cardW) * easeTighten(p); // center, off-left → off-right
        const lag = Math.sin(2 * Math.PI * p) * LATENCY * cardW; // subtle periodic latency
        const x = xC - lag - cardW / 2;
        if (el.complete && el.naturalWidth > 0) ctx.drawImage(el, x, yTop, cardW, cardH);
        if (imageOverlay > 0) {
          ctx.globalAlpha = imageOverlay;
          ctx.fillStyle = "#000";
          ctx.fillRect(x, yTop, cardW, cardH);
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
        tRef.current = (tRef.current + dt) % LOOP_SEC;
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
  }, [images, imageOverlay, animSeed]);

  return <div ref={mountRef} data-anim="true" style={{ position: "absolute", inset: 0 }} />;
});
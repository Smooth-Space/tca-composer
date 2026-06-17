import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ImageItem } from "@/lib/composition";
import type { AnimHandle } from "@/lib/anim";

const HOLD_SEC = 1.6; // pause at center (tunable)
const EASE_SEC = 0.9; // slide transition (tunable)
const FIT_FRAC = 0.86; // image contained within this fraction of the band (tunable)

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
      const k = Math.floor(tt / cycle); // current centered image
      const local = tt - k * cycle;
      const adv =
        local < HOLD_SEC
          ? k // holding image k at center
          : k + easeInOut((local - HOLD_SEC) / EASE_SEC); // sliding k -> k+1

      const S = W; // one band-width per slot (one centered at a time)
      const span = N * S;
      const Xoff = -adv * S;

      for (let i = 0; i < N; i++) {
        let x = i * S + Xoff;
        x = ((x % span) + span) % span; // wrap to nearest copy
        if (x > span / 2) x -= span; // center the window on 0
        const im = imgs[i];
        const ar =
          im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
        let cw = FIT_FRAC * W,
          ch = cw / ar; // contain within the band
        if (ch > FIT_FRAC * H) {
          ch = FIT_FRAC * H;
          cw = ch * ar;
        }
        const cx = W / 2 + x; // center x on screen
        const left = cx - cw / 2,
          top = (H - ch) / 2;
        if (left + cw < 0 || left > W) continue; // off-screen -> skip
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
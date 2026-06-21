import { useEffect, useRef, useState } from "react";

const LOOP_SEC = 10;

/**
 * Drives titlePhase forward over a 10-second seamless loop via rAF.
 *
 * Returns [currentPhase, setExportPhase]:
 *   setExportPhase(p: number) — freeze rAF and lock to p (call per export frame)
 *   setExportPhase(null)      — resume rAF from the last locked phase
 *
 * When enabled=false, returns basePhase unchanged with no rAF running.
 */
export function useTitlePhase(
  enabled: boolean,
  playing: boolean,
  basePhase: number,
): [number, (p: number | null) => void] {
  const [phase, setPhase] = useState(basePhase);
  const ref = useRef({ playing, phase: basePhase, exporting: false });

  useEffect(() => {
    ref.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    if (!enabled) {
      ref.current.phase = basePhase;
      setPhase(basePhase);
      return;
    }
    // Reset to basePhase whenever enabled or basePhase changes.
    ref.current.phase = basePhase;
    ref.current.exporting = false;
    setPhase(basePhase);

    let lastTime: number | null = null;
    let rafId: number;

    const tick = (now: number) => {
      if (!ref.current.exporting && ref.current.playing) {
        if (lastTime !== null) {
          const dt = (now - lastTime) / 1000;
          ref.current.phase = (ref.current.phase + dt / LOOP_SEC) % 1;
          setPhase(ref.current.phase);
        }
        lastTime = now;
      } else {
        // Paused or exporting — reset so there's no jump on resume.
        lastTime = null;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled, basePhase]);

  const setExportPhase = (p: number | null) => {
    if (p === null) {
      ref.current.exporting = false;
    } else {
      ref.current.exporting = true;
      ref.current.phase = p;
      setPhase(p);
    }
  };

  return [enabled ? phase : basePhase, setExportPhase];
}

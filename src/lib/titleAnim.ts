import { useEffect, useRef, useState } from "react";
import { axesToCss, computeAxes, type Mode } from "@/lib/engine";

const LOOP_SEC = 10;
const TITLE_FONT_FAMILY = "ABC Arizona Plus Variable";

/**
 * True once the variable title font has finished loading/parsing. The live
 * animation must not run before this — writing per-frame font-variation-settings
 * while the face is still parsing can crash the tab on a cold load. SSR-safe:
 * starts false (server + initial hydration), resolves true on the client after
 * mount, so there's no hydration mismatch.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      setReady(true); // no Font Loading API — don't block
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.load(`1em '${TITLE_FONT_FAMILY}'`);
      } catch {
        // ignore — fall through to the global ready promise
      }
      try {
        await document.fonts.ready;
      } catch {
        // ignore — settle anyway so we don't block forever on a failed face
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

/**
 * Drives the title's per-character font-variation-settings over a 10-second
 * seamless loop — WITHOUT routing every frame through React state.
 *
 * During active playback the rAF loop computes axes for the current phase and
 * writes `font-variation-settings` straight to the character span DOM nodes
 * (queried via `[data-tspan]` under `rootRef`). React does not re-render per
 * frame, so there's no per-frame reconciliation of the span tree (the prior
 * approach leaked/crashed the tab on long sessions).
 *
 * React state (`committedPhase`, returned) is only updated:
 *   - on mount / when basePhase or activation changes (reset),
 *   - the moment playback pauses (so the React-rendered tree matches the last
 *     animated frame and there's no visual jump),
 * and the export path drives phase explicitly through `exportPhase` (a normal
 * React render at each frozen phase), keeping export deterministic.
 *
 * Phase is computed from absolute elapsed time against a fixed anchor per play
 * segment, so no floating-point drift accumulates over the loop.
 */
export function useTitleSpanAnimation(params: {
  rootRef: React.RefObject<HTMLElement | null>;
  animActive: boolean;
  playing: boolean;
  exportPhase: number | null;
  basePhase: number;
  flatChars: string[];
  mode: Mode;
  seed: number;
  amplitude: number | null;
  fontsReady: boolean;
}): number {
  const {
    rootRef,
    animActive,
    playing,
    exportPhase,
    basePhase,
    flatChars,
    mode,
    seed,
    amplitude,
    fontsReady,
  } = params;

  const [committedPhase, setCommittedPhase] = useState(basePhase);
  const ref = useRef({ playing, exporting: exportPhase !== null, phase: basePhase });

  useEffect(() => {
    ref.current.playing = playing;
  }, [playing]);
  useEffect(() => {
    ref.current.exporting = exportPhase !== null;
  }, [exportPhase]);

  // Reset to basePhase whenever the start phase or activation changes.
  useEffect(() => {
    ref.current.phase = basePhase;
    setCommittedPhase(basePhase);
  }, [basePhase, animActive]);

  useEffect(() => {
    // Gate on fontsReady: don't start the rAF (per-frame fvs writes) until the
    // variable font has loaded. Until then the title renders statically at the
    // committed base phase; when fonts resolve, this effect re-runs and animates.
    if (!animActive || exportPhase !== null || !fontsReady) return;

    const write = (phase: number) => {
      const root = rootRef.current;
      if (!root) return;
      const spans = root.querySelectorAll<HTMLElement>("[data-tspan]");
      if (spans.length === 0) return;
      const ax = computeAxes(flatChars, mode, seed, {
        amplitude,
        phase,
        forceDistribution: mode === "mixed" ? "sine" : undefined,
        forceAmplitude: mode !== "mixed" ? 1 : undefined,
        round: false,
      });
      const n = Math.min(spans.length, ax.length);
      for (let i = 0; i < n; i++) {
        // Skip whitespace spans: their advance is held constant (rendered once at
        // the base phase) so word boundaries don't reflow sub-pixel each frame.
        // Still iterate every [data-tspan] so i stays aligned with the axes array.
        if (spans[i].dataset.tspace !== undefined) continue;
        // Set fvs on the outer letter box; the inner strut + centered glyph inherit
        // it (font-variation-settings is an inherited property), so the visible
        // centered glyph animates without needing to be targeted directly.
        spans[i].style.fontVariationSettings = axesToCss(ax[i]);
      }
    };

    let anchorTime: number | null = null;
    let anchorPhase = ref.current.phase;
    let wasPlaying = false;
    let rafId: number;

    const tick = (now: number) => {
      const running = ref.current.playing && !ref.current.exporting;
      if (running) {
        if (anchorTime === null) {
          anchorTime = now;
          anchorPhase = ref.current.phase;
        }
        const p = (anchorPhase + (now - anchorTime) / (LOOP_SEC * 1000)) % 1;
        ref.current.phase = p;
        write(p); // direct DOM mutation — no React re-render
        wasPlaying = true;
      } else {
        anchorTime = null;
        if (wasPlaying) {
          // Just paused — commit the current phase so the React tree matches.
          wasPlaying = false;
          setCommittedPhase(ref.current.phase);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animActive, exportPhase, fontsReady, rootRef, flatChars, mode, seed, amplitude]);

  return committedPhase;
}

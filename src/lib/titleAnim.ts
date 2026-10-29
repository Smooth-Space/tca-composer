import { useEffect, useState } from "react";

const TITLE_FONT_FAMILY = "ABC Arizona Superfamily Variable";

/**
 * True once the variable title font has finished loading/parsing.
 *
 * Live title-animation playback has been removed (the per-frame rAF loop was
 * unstable), so this no longer gates an animation loop — it's used to disable the
 * "Export animated title" toggle until the face is ready. SSR-safe: starts false
 * (server + initial hydration), resolves true on the client after mount, so
 * there's no hydration mismatch. (MP4 export also awaits document.fonts.ready on
 * its own before capturing.)
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

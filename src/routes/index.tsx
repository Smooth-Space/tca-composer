import { createFileRoute } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { get, set, del } from "idb-keyval";
import { toJpeg, toPng, toCanvas } from "html-to-image";
import { ControlPanel } from "@/components/ControlPanel";
import { Canvas } from "@/components/Canvas";
import { exportLoopMp4, exportTitleMp4 } from "@/lib/mp4Export";
import { exportFreeformSVG } from "@/lib/freeformSvg";
import type { MultiSphereHandle } from "@/components/MultiSphere";
import {
  defaultComposition,
  normalizeComposition,
  type Composition,
  type Format,
} from "@/lib/composition";
import { resolveWave } from "@/lib/engine";
import { useFontsReady } from "@/lib/titleAnim";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Typographic Composer" },
      { name: "description", content: "A minimal tool for building typographic compositions." },
      { property: "og:title", content: "Typographic Composer" },
      { property: "og:description", content: "A minimal tool for building typographic compositions." },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "tca-composition";
const VERSION = 8;

function nativeRectWithin(node: HTMLElement, ancestor: HTMLElement) {
  let x = 0,
    y = 0,
    el: HTMLElement | null = node;
  while (el && el !== ancestor) {
    x += el.offsetLeft;
    y += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return { x, y, w: node.clientWidth, h: node.clientHeight };
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown, info: unknown) {
    console.error("App error:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <p>Something went wrong — your work is saved.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Index() {
  return (
    <ErrorBoundary>
      <Composer />
    </ErrorBoundary>
  );
}

function Composer() {
  const [comp, setComp] = useState<Composition>(defaultComposition);
  const compositionRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<MultiSphereHandle>(null);
  const areaWidthRef = useRef(1080);
  const [exporting, setExporting] = useState(false);
  const [exportingMp4, setExportingMp4] = useState(false);
  const [mp4Progress, setMp4Progress] = useState(0);
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<{ id: string | null; mode: "end" | "all"; nonce: number }>(
    { id: null, mode: "end", nonce: 0 },
  );
  const onRequestEdit = (id: string, mode: "end" | "all") => {
    setSelectedTitleId(id);
    setFocusReq((r) => ({ id, mode, nonce: r.nonce + 1 }));
  };
  const hideSelection = exporting || exportingMp4;

  // Resolved static phase — the title animation loop's starting point. Live
  // playback runs inside TitleBlock (direct DOM writes, no per-frame React);
  // exportPhase is only set during MP4 export to drive deterministic frames.
  const resolvedPhase =
    comp.titlePhase !== null ? comp.titlePhase : resolveWave(comp.titleMode, comp.titleSeed).phase;

  const [exportPhase, setExportPhase] = useState<number | null>(null);

  // Gate live title animation on font load — the variable face must be parsed
  // before the rAF starts writing per-frame variations, or a cold load can crash.
  const fontsReady = useFontsReady();

  // Restore once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = (await get(STORAGE_KEY)) as
          | { version: number; data: Partial<Composition> }
          | undefined;
        if (!cancelled && saved && saved.data) {
          setComp(normalizeComposition(saved.data));
        }
      } catch {
        // ignore — keep defaults, never crash on bad/old saved state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced save on every change
  useEffect(() => {
    const t = setTimeout(() => {
      set(STORAGE_KEY, { version: VERSION, data: comp }).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [comp]);

  // Keep latest comp in a ref so the flush handler always saves the freshest value
  const compRef = useRef(comp);
  useEffect(() => {
    compRef.current = comp;
  }, [comp]);

  // Flush-save on hide / unload — safety net against reloads landing mid-debounce
  useEffect(() => {
    const flush = () => {
      set(STORAGE_KEY, { version: VERSION, data: compRef.current }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function handleReset() {
    del(STORAGE_KEY).catch(() => {});
    setComp({
      ...defaultComposition,
      titleSeed: (Math.random() * 0xffffffff) >>> 0,
      multiSeed: (Math.random() * 0xffffffff) >>> 0,
    });
  }

  const NATIVE: Record<Format, [number, number]> = {
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    "9:16": [1080, 1920],
    "3:2": [1080, 720],
  };

  async function handleExport() {
    const node = compositionRef.current;
    if (!node) return;
    setExporting(true);
    try {
      await document.fonts.ready;
      const [w, h] = NATIVE[comp.format];
      const opts = {
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        pixelRatio: 1,
        quality: 0.95,
        backgroundColor: comp.background,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
        },
      };
      // warm-up capture to avoid html-to-image first-render embedding quirk
      await toJpeg(node, {
        quality: 0.95,
        backgroundColor: comp.background,
        style: { transform: "none" },
      });
      const dataUrl = await toJpeg(node, opts);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tca-${comp.format.replace(":", "x")}-${Date.now()}.jpg`;
      a.click();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportMp4() {
    const node = compositionRef.current;
    const sphere = sphereRef.current;
    if (!node || !sphere) return;
    const canvas = sphere.getCanvas();
    const durationSec = sphere.durationSec();
    if (!canvas || durationSec <= 0) return;
    if (!("VideoEncoder" in window)) {
      alert("MP4 export needs a Chromium browser (Chrome or Edge).");
      return;
    }

    setExportingMp4(true);
    setMp4Progress(0);
    try {
      await document.fonts.ready;
      const [w, h] = NATIVE[comp.format];

      // Title + captions → transparent PNG (exclude the globe via data-globe, drop the bg).
      const overlayUrl = await toPng(node, {
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        pixelRatio: 2,
        backgroundColor: undefined,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
          background: "transparent",
        },
        filter: (el) => !(el instanceof HTMLElement && el.dataset.anim === "true"),
      });
      const overlayImg = new Image();
      overlayImg.src = overlayUrl;
      await overlayImg.decode();

      sphere.setExporting(true); // pause live rAF; exporter drives frames
      const rect = nativeRectWithin(canvas, node);
      await exportLoopMp4({
        w,
        h,
        fps: 30,
        durationSec,
        seekAndRender: (t) => sphere.seekAndRender(t),
        globeCanvas: canvas,
        overlayImg,
        background: comp.background,
        onProgress: setMp4Progress,
        filename: `tca-${comp.format.replace(":", "x")}-${Date.now()}.mp4`,
        rect,
      });
    } catch (err) {
      console.error("MP4 export failed", err);
    } finally {
      sphereRef.current?.setExporting(false);
      setExportingMp4(false);
    }
  }

  async function handleExportTitleMp4() {
    const node = compositionRef.current;
    if (!node) return;
    if (!("VideoEncoder" in window)) {
      alert("MP4 export needs a Chromium browser (Chrome or Edge).");
      return;
    }

    setExportingMp4(true);
    setMp4Progress(0);
    try {
      await document.fonts.ready;
      const [w, h] = NATIVE[comp.format];
      const basePhase = resolvedPhase;
      const captureOpts = {
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        pixelRatio: 1,
        backgroundColor: comp.background,
        style: {
          transform: "none",
          transformOrigin: "top left",
          margin: "0",
        },
      };
      await exportTitleMp4({
        w,
        h,
        fps: 30,
        durationSec: 10,
        renderFrame: async (i, total) => {
          const p = (basePhase + i / total) % 1;
          setExportPhase(p);
          // Two rAF ticks: first for React to commit, second for the browser to paint.
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          return toCanvas(node, captureOpts);
        },
        onProgress: setMp4Progress,
        filename: `tca-title-${comp.format.replace(":", "x")}-${Date.now()}.mp4`,
      });
    } catch (err) {
      console.error("Title MP4 export failed", err);
    } finally {
      setExportPhase(null); // resume live rAF
      setExportingMp4(false);
    }
  }

  async function handleExportSvg() {
    try {
      await document.fonts.ready;
      await exportFreeformSVG(comp, areaWidthRef.current);
    } catch (err) {
      console.error("SVG export failed", err);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ControlPanel
        comp={comp}
        setComp={setComp}
        onExport={handleExport}
        exporting={exporting}
        onReset={handleReset}
        onExportMp4={handleExportMp4}
        onExportTitleMp4={handleExportTitleMp4}
        exportingMp4={exportingMp4}
        mp4Progress={mp4Progress}
        onExportSvg={handleExportSvg}
        selectedTitleId={selectedTitleId}
        onSelectTitle={setSelectedTitleId}
        focusReq={focusReq}
        fontsReady={fontsReady}
      />
      <main className="flex-1">
        <Canvas
          comp={comp}
          compositionRef={compositionRef}
          sphereRef={sphereRef}
          selectedTitleId={selectedTitleId}
          onSelectTitle={setSelectedTitleId}
          onRequestEdit={onRequestEdit}
          hideSelection={hideSelection}
          titleBasePhase={resolvedPhase}
          exportPhase={exportPhase}
          fontsReady={fontsReady}
          onAreaWidth={(w) => {
            areaWidthRef.current = w;
          }}
        />
      </main>
    </div>
  );
}

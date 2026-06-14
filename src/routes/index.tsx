import { createFileRoute } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { get, set, del } from "idb-keyval";
import { toJpeg } from "html-to-image";
import { ControlPanel } from "@/components/ControlPanel";
import { Canvas } from "@/components/Canvas";
import { defaultComposition, type Composition, type Format } from "@/lib/composition";

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
const VERSION = 1;

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
  const [exporting, setExporting] = useState(false);

  // Restore once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = (await get(STORAGE_KEY)) as
          | { version: number; data: Partial<Composition> }
          | undefined;
        if (!cancelled && saved && saved.version === VERSION && saved.data) {
          setComp({ ...defaultComposition, ...saved.data });
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
    }, 400);
    return () => clearTimeout(t);
  }, [comp]);

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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ControlPanel
        comp={comp}
        setComp={setComp}
        onExport={handleExport}
        exporting={exporting}
        onReset={handleReset}
      />
      <main className="flex-1">
        <Canvas comp={comp} compositionRef={compositionRef} />
      </main>
    </div>
  );
}

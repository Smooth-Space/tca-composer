import { useEffect, useRef, useState } from "react";
import type { Composition } from "@/lib/composition";
import { TitleBlock } from "@/components/TitleBlock";

export function FreeformCanvas({
  comp,
  compositionRef,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
  onAreaWidth,
}: {
  comp: Composition;
  compositionRef?: React.Ref<HTMLDivElement>;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
  onAreaWidth?: (w: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState(1080);
  const [areaHeight, setAreaHeight] = useState(1080);

  // Measure the available canvas-area content-box width (responsive, unbound).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) {
        setAreaWidth(w);
        onAreaWidth?.(w);
      }
      if (h > 0) setAreaHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAreaWidth]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-muted"
      onClick={() => onSelectTitle?.(null)}
    >
      {/* Full-height artboard: width = area width, height = area height, type centered, never clipped. */}
      <div
        ref={compositionRef}
        style={{
          width: areaWidth,
          height: areaHeight,
          background: "#FFFFFF",
          position: "relative",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ width: areaWidth }}>
        <TitleBlock
          titles={comp.titles}
          titleMode={comp.titleMode}
          titleSeed={comp.titleSeed}
          titleAmplitude={comp.titleAmplitude}
          titlePhase={comp.titlePhase}
          titleSizePx={comp.titleSizePx}
          titleColor="#000000"
          titleSizeMode={comp.titleSizeMode}
          titleShift={comp.titleShift}
          titleShiftSeed={comp.titleShiftSeed}
          contentWidthPx={areaWidth}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        />
        </div>
      </div>
    </div>
  );
}
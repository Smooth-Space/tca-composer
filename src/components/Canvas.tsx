import { type Composition } from "@/lib/composition";
import { useEffect, useMemo, useRef, useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { computeMultiLayout, MULTI_PLACEHOLDER_ASPECTS } from "@/lib/multiLayout";
import { TemplateA } from "@/components/TemplateA";
import { TemplateD } from "@/components/TemplateD";
import { FreeformCanvas } from "@/components/FreeformCanvas";
import { SelectionProvider, useSelection } from "@/components/SelectionContext";
import type { MultiSphereHandle } from "@/components/MultiSphere";

const FORMAT_DIMENSIONS: Record<Composition["format"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "3:2": { w: 1080, h: 720 },
};

export function Canvas({
  comp,
  compositionRef,
  sphereRef,
  selectedTitleId,
  onSelectTitle,
  onRequestEdit,
  hideSelection,
  onAreaWidth,
  titleBasePhase,
  exportPhase,
  fontsReady,
}: {
  comp: Composition;
  compositionRef?: React.Ref<HTMLDivElement>;
  sphereRef?: React.Ref<MultiSphereHandle>;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  onRequestEdit?: (id: string, mode: "end" | "all") => void;
  hideSelection?: boolean;
  onAreaWidth?: (w: number) => void;
  titleBasePhase?: number;
  exportPhase?: number | null;
  fontsReady?: boolean;
}) {
  return (
    <SelectionProvider
      selectedTitleId={selectedTitleId ?? null}
      onSelectTitle={onSelectTitle ?? (() => {})}
      onRequestEdit={onRequestEdit ?? (() => {})}
      hideSelection={!!hideSelection}
    >
      {comp.template === "freeform" ? (
        <FreeformCanvas comp={comp} compositionRef={compositionRef} onAreaWidth={onAreaWidth} />
      ) : (
        <FixedCanvas
          comp={comp}
          compositionRef={compositionRef}
          sphereRef={sphereRef}
          titleBasePhase={titleBasePhase}
          exportPhase={exportPhase}
          fontsReady={fontsReady}
        />
      )}
    </SelectionProvider>
  );
}

function FixedCanvas({
  comp,
  compositionRef,
  sphereRef,
  titleBasePhase,
  exportPhase,
  fontsReady,
}: {
  comp: Composition;
  compositionRef?: React.Ref<HTMLDivElement>;
  sphereRef?: React.Ref<MultiSphereHandle>;
  titleBasePhase?: number;
  exportPhase?: number | null;
  fontsReady?: boolean;
}) {
  const { onSelectTitle } = useSelection();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { w, h } = FORMAT_DIMENSIONS[comp.format];
  const imgSrc = comp.images[0]?.src ?? "";

  const multiPlacements = useMemo(
    () =>
      computeMultiLayout(
        comp.images.length ? comp.images : MULTI_PLACEHOLDER_ASPECTS,
        w,
        h,
        comp.titles.length,
        comp.titleSizePx,
        comp.multiSeed,
      ),
    [comp.images, w, h, comp.titles.length, comp.titleSizePx, comp.multiSeed],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const pad = 64;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      setScale(Math.min(availW / w, availH / h, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  const title = (
    <TitleBlock
      titles={comp.titles}
      titleMode={comp.titleMode}
      titleSeed={comp.titleSeed}
      titleAmplitude={comp.titleAmplitude}
      titlePhase={comp.titlePhase}
      titleAnimate={comp.titleAnimate}
      titleAnimPlaying={comp.titleAnimPlaying}
      titleBasePhase={titleBasePhase}
      exportPhase={exportPhase}
      fontsReady={fontsReady}
      titleSizePx={comp.titleSizePx}
      titleColor={comp.titleColor}
      titleSizeMode={comp.titleSizeMode}
      titleShift={comp.titleShift}
      titleShiftSeed={comp.titleShiftSeed}
      titleShiftAmount={comp.titleShiftAmount}
      contentWidthPx={w - 80}
    />
  );

  const renderInner = () => {
    if (comp.template === "D") {
      return <TemplateD comp={comp} w={w} h={h} imgSrc={imgSrc} sphereRef={sphereRef} />;
    }
    return (
      <TemplateA
        comp={comp}
        w={w}
        h={h}
        imgSrc={imgSrc}
        title={title}
        multiPlacements={multiPlacements}
        sphereRef={sphereRef}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-muted"
      onClick={() => onSelectTitle(null)}
    >
      <div style={{ width: w * scale, height: h * scale }} className="shadow-2xl">
        <div
          ref={compositionRef}
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: comp.background,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {renderInner()}
        </div>
      </div>
    </div>
  );
}

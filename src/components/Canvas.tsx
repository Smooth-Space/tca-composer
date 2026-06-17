import { PLACEHOLDER_SRC, type Composition } from "@/lib/composition";
import { useEffect, useMemo, useRef, useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { computeMultiLayout } from "@/lib/multiLayout";
import { TemplateA } from "@/components/TemplateA";
import { TemplateBC } from "@/components/TemplateBC";
import { TemplateD } from "@/components/TemplateD";
import type { MultiSphereHandle } from "@/components/MultiSphere";

const FORMAT_DIMENSIONS: Record<Composition["format"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

export function Canvas({
  comp,
  compositionRef,
  sphereRef,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  comp: Composition;
  compositionRef?: React.Ref<HTMLDivElement>;
  sphereRef?: React.Ref<MultiSphereHandle>;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { w, h } = FORMAT_DIMENSIONS[comp.format];
  const imgSrc = comp.images[0]?.src ?? PLACEHOLDER_SRC;

  const multiPlacements = useMemo(
    () =>
      computeMultiLayout(
        comp.images,
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
      titleSizePx={comp.titleSizePx}
      titleColor={comp.titleColor}
      titleSizeMode={comp.titleSizeMode}
      titleShift={comp.titleShift}
      titleShiftSeed={comp.titleShiftSeed}
      contentWidthPx={w - 80}
      selectedTitleId={selectedTitleId}
      onSelectTitle={onSelectTitle}
      hideSelection={hideSelection}
    />
  );

  const renderInner = () => {
    if (comp.template === "D") {
      return (
        <TemplateD
          comp={comp}
          w={w}
          h={h}
          imgSrc={imgSrc}
          sphereRef={sphereRef}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        />
      );
    }
    if (comp.template === "A") {
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
    }
    return (
      <TemplateBC
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
      onClick={() => onSelectTitle?.(null)}
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

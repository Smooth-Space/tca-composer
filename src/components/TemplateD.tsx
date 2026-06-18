import { useMemo } from "react";
import type { Composition } from "@/lib/composition";
import { computeAxes, type Axes } from "@/lib/engine";
import { computeMultiLayout } from "@/lib/multiLayout";
import { TitleLine } from "@/components/TitleLine";
import { Caption } from "@/components/Caption";
import { type MultiSphereHandle } from "@/components/MultiSphere";
import { BackgroundLayer, SplitImageRegion } from "@/components/ImageRegions";

function PinnedTitle({
  pin,
  comp,
  dLines,
  dAxes,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  pin: 0 | 1;
  comp: Composition;
  dLines: { text: string; startOffset: number; pin: 0 | 1; key: string }[];
  dAxes: Axes[];
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  const pinId = comp.titles[pin]?.id ?? null;
  const isSelected = !!selectedTitleId && selectedTitleId === pinId;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectTitle?.(pinId);
      }}
      style={{
        cursor: "text",
        outline: isSelected && !hideSelection ? "2px solid rgba(80,120,255,0.7)" : "none",
        outlineOffset: 4,
      }}
    >
      {comp.titles[pin]?.text === "" && !hideSelection && (
        <span style={{ opacity: 0.3, color: comp.titleColor }}>Title</span>
      )}
      {dLines
        .filter((l) => l.pin === pin)
        .map((l) => (
          <TitleLine
            key={l.key}
            text={l.text}
            axes={dAxes}
            startOffset={l.startOffset}
            titleSizePx={comp.titleSizePx}
            color={comp.titleColor}
          />
        ))}
    </div>
  );
}

export function TemplateD({
  comp,
  w,
  h,
  imgSrc,
  sphereRef,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  sphereRef?: React.Ref<MultiSphereHandle>;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  const dTitles = useMemo(
    () => [comp.titles[0]?.text ?? "", comp.titles[1]?.text ?? ""],
    [comp.titles],
  );
  const dAxes = useMemo(
    () =>
      computeAxes(
        dTitles.flatMap((t) => Array.from(t.replace(/\n/g, ""))),
        comp.titleMode,
        comp.titleSeed,
        { amplitude: comp.titleAmplitude, phase: comp.titlePhase },
      ),
    [dTitles, comp.titleMode, comp.titleSeed, comp.titleAmplitude, comp.titlePhase],
  );
  // Rows for each title, with global start offsets into the shared axis stream.
  const dLines = useMemo(() => {
    const out: { text: string; startOffset: number; pin: 0 | 1; key: string }[] = [];
    let acc = 0;
    dTitles.forEach((t, pin) => {
      t.split("\n").forEach((text, i) => {
        out.push({ text, startOffset: acc, pin: pin as 0 | 1, key: `${pin}-${i}` });
        acc += Array.from(text).length;
      });
    });
    return out;
  }, [dTitles]);

  const multiPlacements = useMemo(
    () => computeMultiLayout(comp.images, w, h, 2, comp.titleSizePx, comp.multiSeed, 0),
    [comp.images, w, h, comp.titleSizePx, comp.multiSeed],
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <BackgroundLayer comp={comp} w={w} h={h} imgSrc={imgSrc} multiPlacements={multiPlacements} sphereRef={sphereRef} />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <PinnedTitle
          pin={0}
          comp={comp}
          dLines={dLines}
          dAxes={dAxes}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        />

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {comp.variant === "split" && (
            <div style={{ position: "absolute", inset: 0 }}>
              <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              gap: 40,
              alignItems: "center",
            }}
          >
            <Caption
              text={comp.captions.text1}
              color={comp.captionColors.text1}
              align="left"
              captionKey="text1"
              selectedTitleId={selectedTitleId}
              onSelectTitle={onSelectTitle}
              hideSelection={hideSelection}
              hidden={comp.captionHidden.text1}
              style={{ flex: 1, paddingLeft: comp.variant === "split" ? 40 : 0 }}
            />
            <Caption
              text={comp.captions.text2}
              color={comp.captionColors.text2}
              align="right"
              captionKey="text2"
              selectedTitleId={selectedTitleId}
              onSelectTitle={onSelectTitle}
              hideSelection={hideSelection}
              hidden={comp.captionHidden.text2}
              style={{ flex: 1, paddingRight: comp.variant === "split" ? 40 : 0 }}
            />
          </div>
        </div>

        <PinnedTitle
          pin={1}
          comp={comp}
          dLines={dLines}
          dAxes={dAxes}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        />
      </div>
    </div>
  );
}
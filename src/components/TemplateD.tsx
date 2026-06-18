import { useMemo } from "react";
import type { Composition } from "@/lib/composition";
import { computeAxes } from "@/lib/engine";
import { computeMultiLayout } from "@/lib/multiLayout";
import { TitleLine } from "@/components/TitleLine";
import { Caption } from "@/components/Caption";
import { CoverImage, MultiImages, Overlay } from "@/components/ImageLayers";
import { MultiSphere, type MultiSphereHandle } from "@/components/MultiSphere";
import { SplitConveyor } from "@/components/SplitConveyor";

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
      {comp.variant === "full" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <CoverImage src={imgSrc} />
          <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
        </div>
      )}
      {comp.variant === "multi" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {comp.animate ? (
            <MultiSphere
              ref={sphereRef}
              images={comp.images}
              w={w}
              h={h}
              imageOverlay={comp.imageOverlay}
              animSeed={comp.animSeed}
              playing={comp.animPlaying}
            globeScale={comp.globeScale}
            />
          ) : (
            <MultiImages images={comp.images} placements={multiPlacements} imageOverlay={comp.imageOverlay} />
          )}
        </div>
      )}

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
        {[0 as const].map((pin) => {
          const pinId = comp.titles[pin]?.id ?? null;
          const isSelected = !!selectedTitleId && selectedTitleId === pinId;
          return (
            <div
              key="pin-0"
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
        })}

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {comp.variant === "split" && (
            <div style={{ position: "absolute", inset: 0 }}>
              {comp.animate ? (
                <SplitConveyor
                  ref={sphereRef}
                  images={comp.images}
                  imageOverlay={comp.imageOverlay}
                  animSeed={comp.animSeed}
                  playing={comp.animPlaying}
                />
              ) : (
                <>
                  <CoverImage src={imgSrc} />
                  <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
                </>
              )}
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

        {[1 as const].map((pin) => {
          const pinId = comp.titles[pin]?.id ?? null;
          const isSelected = !!selectedTitleId && selectedTitleId === pinId;
          return (
            <div
              key="pin-1"
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
        })}
      </div>
    </div>
  );
}
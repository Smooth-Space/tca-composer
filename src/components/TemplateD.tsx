import { useMemo } from "react";
import type { Composition } from "@/lib/composition";
import { computeAxes } from "@/lib/engine";
import { computeMultiLayout } from "@/lib/multiLayout";
import { TitleLine } from "@/components/TitleLine";
import { Caption } from "@/components/Caption";
import { CoverImage, MultiImages, Overlay } from "@/components/ImageLayers";

export function TemplateD({
  comp,
  w,
  h,
  imgSrc,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
}) {
  const dRows = useMemo(
    () => [comp.titles[0]?.text ?? "", comp.titles[1]?.text ?? ""],
    [comp.titles],
  );
  const dAxes = useMemo(
    () => computeAxes(dRows.flatMap((r) => Array.from(r)), comp.titleMode, comp.titleSeed),
    [dRows, comp.titleMode, comp.titleSeed],
  );
  const bottomOffset = Array.from(dRows[0]).length;

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
          <MultiImages images={comp.images} placements={multiPlacements} imageOverlay={comp.imageOverlay} />
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
        <TitleLine
          text={dRows[0]}
          axes={dAxes}
          startOffset={0}
          titleSizePx={comp.titleSizePx}
          color={comp.titleColor}
        />

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {comp.variant === "split" && (
            <div style={{ position: "absolute", inset: 0 }}>
              <CoverImage src={imgSrc} />
              <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
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
            <Caption text={comp.captions.text1} color={comp.captionColors.text1} align="left" style={{ flex: 1 }} />
            <Caption text={comp.captions.text2} color={comp.captionColors.text2} align="right" style={{ flex: 1 }} />
          </div>
        </div>

        <TitleLine
          text={dRows[1]}
          axes={dAxes}
          startOffset={bottomOffset}
          titleSizePx={comp.titleSizePx}
          color={comp.titleColor}
        />
      </div>
    </div>
  );
}
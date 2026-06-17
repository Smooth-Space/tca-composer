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
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  sphereRef?: React.Ref<MultiSphereHandle>;
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
      ),
    [dTitles, comp.titleMode, comp.titleSeed],
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
        <div>
          {dLines
            .filter((l) => l.pin === 0)
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
            <Caption text={comp.captions.text1} color={comp.captionColors.text1} align="left" style={{ flex: 1, paddingLeft: comp.variant === "split" ? 40 : 0 }} />
            <Caption text={comp.captions.text2} color={comp.captionColors.text2} align="right" style={{ flex: 1, paddingRight: comp.variant === "split" ? 40 : 0 }} />
          </div>
        </div>

        <div>
          {dLines
            .filter((l) => l.pin === 1)
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
      </div>
    </div>
  );
}
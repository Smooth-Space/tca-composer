import { useMemo } from "react";
import { TEMPLATE_CAPTIONS, getVisibleRowSlots, type Composition } from "@/lib/composition";
import { computeAxes, type Axes } from "@/lib/engine";
import { titleDisplay, applyItalic } from "@/lib/titleItalic";
import { computeMultiLayout, MULTI_PLACEHOLDER_ASPECTS } from "@/lib/multiLayout";
import { TitleLine } from "@/components/TitleLine";
import { Caption } from "@/components/Caption";
import { type MultiSphereHandle } from "@/components/MultiSphere";
import { BackgroundLayer, SplitImageRegion } from "@/components/ImageRegions";
import { useSelectable } from "@/components/SelectionContext";

function PinnedTitle({
  pin,
  comp,
  dLines,
  dAxes,
  cleanText,
}: {
  pin: 0 | 1;
  comp: Composition;
  dLines: { text: string; startOffset: number; pin: 0 | 1; key: string }[];
  dAxes: Axes[];
  // Markup-stripped text, so a title holding only italic delimiters still counts
  // as empty and shows its placeholder.
  cleanText: string;
}) {
  const { handleClick, handleDoubleClick, hideSelection, selectableStyle } = useSelectable(
    comp.titles[pin]?.id ?? null,
  );
  const isEmpty = cleanText.trim() === "";
  const placeholderLabel = pin === 0 ? "Title 1" : "Title 2";
  const placeholderAxes = useMemo(
    () =>
      computeAxes(Array.from(placeholderLabel), comp.titleMode, comp.titleSeed, {
        amplitude: comp.titleAmplitude,
        phase: comp.titlePhase,
      }),
    [placeholderLabel, comp.titleMode, comp.titleSeed, comp.titleAmplitude, comp.titlePhase],
  );
  return (
    <div onClick={handleClick} onDoubleClick={handleDoubleClick} style={selectableStyle}>
      {isEmpty && !hideSelection && (
        <div style={{ visibility: "hidden" }} aria-hidden="true">
          <TitleLine
            text={placeholderLabel}
            axes={placeholderAxes}
            startOffset={0}
            titleSizePx={comp.titleSizePx}
            color={comp.titleColor}
          />
        </div>
      )}
      {!isEmpty &&
        dLines
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
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  sphereRef?: React.Ref<MultiSphereHandle>;
}) {
  // Both titles are parsed independently (markup + Mixed-mode uppercase, both
  // display-only) and then concatenated into ONE shared axis stream, so the wave
  // runs continuously across the pair exactly as it did before italics existed.
  const dParsed = useMemo(() => {
    const up = comp.titleMode === "mixed";
    return [comp.titles[0]?.text ?? "", comp.titles[1]?.text ?? ""].map((t) => titleDisplay(t, up));
  }, [comp.titles, comp.titleMode]);
  const dAxes = useMemo(
    () =>
      applyItalic(
        computeAxes(
          dParsed.flatMap((d) => d.flatChars),
          comp.titleMode,
          comp.titleSeed,
          { amplitude: comp.titleAmplitude, phase: comp.titlePhase },
        ),
        dParsed.flatMap((d) => d.flatItalic),
      ),
    [dParsed, comp.titleMode, comp.titleSeed, comp.titleAmplitude, comp.titlePhase],
  );
  // Rows for each title, with global start offsets into the shared axis stream.
  const dLines = useMemo(() => {
    const out: { text: string; startOffset: number; pin: 0 | 1; key: string }[] = [];
    let acc = 0;
    dParsed.forEach((d, pin) => {
      d.rows.forEach((text, i) => {
        out.push({ text, startOffset: acc + d.rowStart[i], pin: pin as 0 | 1, key: `${pin}-${i}` });
      });
      acc += d.flatChars.length;
    });
    return out;
  }, [dParsed]);

  const multiPlacements = useMemo(
    () =>
      computeMultiLayout(
        comp.images.length ? comp.images : MULTI_PLACEHOLDER_ASPECTS,
        w,
        h,
        2,
        comp.titleSizePx,
        comp.multiSeed,
        0,
      ),
    [comp.images, w, h, comp.titleSizePx, comp.multiSeed],
  );

  // Multi + animate: let the globe (inside BackgroundLayer) render in front of titles.
  // Every other state keeps titles above images.
  const contentZ = comp.variant === "multi" && comp.animate ? 0 : 1;
  const bgZ = comp.variant === "multi" && comp.animate ? 1 : 0;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, zIndex: bgZ }}>
        <BackgroundLayer
          comp={comp}
          w={w}
          h={h}
          imgSrc={imgSrc}
          multiPlacements={multiPlacements}
          sphereRef={sphereRef}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: contentZ,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        {/* zIndex:1 within this stacking context keeps titles above captions (zIndex:0) */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <PinnedTitle
            pin={0}
            comp={comp}
            dLines={dLines}
            dAxes={dAxes}
            cleanText={dParsed[0].text}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 0 }}>
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
            {(() => {
              // A single visible input spans the full width within the margins; two split into halves.
              const rowSlots = getVisibleRowSlots(
                TEMPLATE_CAPTIONS.D,
                "middle",
                comp.captionCounts,
                comp.captionHidden,
              );
              const single = rowSlots.length === 1;
              const splitPad = comp.variant === "split" ? 40 : 0;
              return rowSlots.map((slot) => (
                <Caption
                  key={slot.key}
                  text={comp.captions[slot.key]}
                  color={comp.captionColors[slot.key]}
                  align={comp.captionAlign[slot.key]}
                  captionKey={slot.key}
                  hidden={comp.captionHidden[slot.key]}
                  style={{
                    flex: 1,
                    paddingLeft: single || slot.column === "left" ? splitPad : 0,
                    paddingRight: single || slot.column === "right" ? splitPad : 0,
                  }}
                />
              ));
            })()}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <PinnedTitle
            pin={1}
            comp={comp}
            dLines={dLines}
            dAxes={dAxes}
            cleanText={dParsed[1].text}
          />
        </div>
      </div>
    </div>
  );
}

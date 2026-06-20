import {
  TEMPLATE_CAPTIONS,
  getVisibleRowSlots,
  isRowActive,
  type Composition,
} from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";
import { Caption } from "@/components/Caption";
import { TemplateLayout } from "@/components/TemplateLayout";
import { type MultiSphereHandle } from "@/components/MultiSphere";
import { BackgroundLayer, SplitImageRegion } from "@/components/ImageRegions";

export function TemplateA({
  comp,
  w,
  h,
  imgSrc,
  title,
  multiPlacements,
  sphereRef,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  title: React.ReactNode;
  multiPlacements: Placement[];
  sphereRef?: React.Ref<MultiSphereHandle>;
}) {
  const slots = TEMPLATE_CAPTIONS.A;
  const centeredTitle = (
    <div className="flex h-full w-full flex-col items-center justify-center">{title}</div>
  );

  if (comp.variant === "split") {
    // "span": full-width image fills the content area, title floats on top.
    if (comp.splitStyle === "span") {
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <TemplateLayout
            slots={slots}
            captions={comp.captions}
            captionColors={comp.captionColors}
            captionHidden={comp.captionHidden}
            captionAlign={comp.captionAlign}
            captionCounts={comp.captionCounts}
            gap={40}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
            </div>
            <div style={{ position: "absolute", inset: 0 }}>{centeredTitle}</div>
          </TemplateLayout>
        </div>
      );
    }

    // "half-inset": image and title halves sit inside the TemplateLayout margin (inset).
    // Captions occupy the top/bottom margin rows; the halves live in the padded middle.
    if (comp.splitStyle === "half-inset") {
      const imageHalf = (
        <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
          <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
        </div>
      );
      const titleHalf = (
        <div style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 3 }}>
          {centeredTitle}
        </div>
      );
      const middle = (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 40,
          }}
        >
          {comp.splitOrder === "image-first" ? (
            <>
              {imageHalf}
              {titleHalf}
            </>
          ) : (
            <>
              {titleHalf}
              {imageHalf}
            </>
          )}
        </div>
      );
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <TemplateLayout
            slots={slots}
            captions={comp.captions}
            captionColors={comp.captionColors}
            captionHidden={comp.captionHidden}
            captionAlign={comp.captionAlign}
            captionCounts={comp.captionCounts}
            gap={40}
          >
            {middle}
          </TemplateLayout>
        </div>
      );
    }

    // "half" (default): image and title each take exactly half the canvas height, full bleed.
    // Corner captions are absolutely positioned at the top/bottom edges.
    // z-order: image=1, captions=2, title=3
    const imageTop = comp.splitOrder === "image-first";
    const titleAnchor: "top" | "bottom" = imageTop ? "bottom" : "top";
    const titleRowActive = isRowActive(
      slots,
      comp.captions,
      comp.captionHidden,
      comp.captionCounts,
      titleAnchor,
    );
    const outerPad = titleRowActive ? 130 : 40;
    const titlePadding = imageTop
      ? `40px 40px ${outerPad}px 40px`
      : `${outerPad}px 40px 40px 40px`;
    const imageHalf = (
      <div
        style={
          {
            position: "absolute",
            left: 0,
            right: 0,
            height: h / 2,
            [imageTop ? "top" : "bottom"]: 0,
            zIndex: 1,
          } as React.CSSProperties
        }
      >
        <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
      </div>
    );
    const titleHalf = (
      <div
        style={
          {
            position: "absolute",
            left: 0,
            right: 0,
            height: h / 2,
            [imageTop ? "bottom" : "top"]: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: titlePadding,
            boxSizing: "border-box",
            zIndex: 3,
          } as React.CSSProperties
        }
      >
        {title}
      </div>
    );
    const cornerRow = (anchor: "top" | "bottom") => {
      // A single visible input spans the full width within the margins; two split into halves.
      const rowSlots = getVisibleRowSlots(slots, anchor, comp.captionCounts, comp.captionHidden);
      return (
        <div
          key={anchor}
          style={
            {
              position: "absolute",
              left: 0,
              right: 0,
              [anchor]: 0,
              padding: 40,
              display: "flex",
              gap: 40,
              alignItems: "flex-start",
              zIndex: 2,
            } as React.CSSProperties
          }
        >
          {rowSlots.map((slot) => (
            <div key={slot.key} style={{ flex: 1, minWidth: 0 }}>
              <Caption
                text={comp.captions[slot.key]}
                color={comp.captionColors[slot.key]}
                align={comp.captionAlign[slot.key]}
                captionKey={slot.key}
                hidden={comp.captionHidden[slot.key]}
              />
            </div>
          ))}
        </div>
      );
    };
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {imageHalf}
        {titleHalf}
        {cornerRow("top")}
        {cornerRow("bottom")}
      </div>
    );
  }

  // none / full / multi: four corner captions with title centered between rows.
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <BackgroundLayer
          comp={comp}
          w={w}
          h={h}
          imgSrc={imgSrc}
          multiPlacements={multiPlacements}
          sphereRef={sphereRef}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <TemplateLayout
          slots={slots}
          captions={comp.captions}
          captionColors={comp.captionColors}
          captionHidden={comp.captionHidden}
          captionAlign={comp.captionAlign}
          captionCounts={comp.captionCounts}
        >
          {centeredTitle}
        </TemplateLayout>
      </div>
    </div>
  );
}

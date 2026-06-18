import { TEMPLATE_CAPTIONS, type Composition } from "@/lib/composition";
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
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  title: React.ReactNode;
  multiPlacements: Placement[];
  sphereRef?: React.Ref<MultiSphereHandle>;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  const slots = TEMPLATE_CAPTIONS.A;
  const centeredTitle = (
    <div className="flex h-full w-full flex-col items-center justify-center">{title}</div>
  );

  if (comp.variant === "split") {
    const imageTop = comp.splitOrder === "image-first";
    const imageHalf = (
      <div
        style={
          {
            position: "absolute",
            left: 0,
            right: 0,
            height: h / 2,
            [imageTop ? "top" : "bottom"]: 0,
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
            padding: imageTop ? "40px 40px 130px 40px" : "130px 40px 40px 40px",
            boxSizing: "border-box",
          } as React.CSSProperties
        }
      >
        {title}
      </div>
    );
    const cornerRow = (anchor: "top" | "bottom") => {
      const rowSlots = slots.filter((s) => s.anchor === anchor);
      const left = rowSlots.find((s) => s.column === "left");
      const right = rowSlots.find((s) => s.column === "right");
      return (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            [anchor]: 0,
            padding: 40,
            display: "flex",
            gap: 40,
            alignItems: anchor === "top" ? "flex-start" : "flex-end",
          } as React.CSSProperties}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {left && (
              <Caption
                text={comp.captions[left.key]}
                color={comp.captionColors[left.key]}
                align="left"
                captionKey={left.key}
                selectedTitleId={selectedTitleId}
                onSelectTitle={onSelectTitle}
                hideSelection={hideSelection}
              hidden={comp.captionHidden[left.key]}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {right && (
              <Caption
                text={comp.captions[right.key]}
                color={comp.captionColors[right.key]}
                align="left"
                captionKey={right.key}
                selectedTitleId={selectedTitleId}
                onSelectTitle={onSelectTitle}
                hideSelection={hideSelection}
              hidden={comp.captionHidden[right.key]}
              />
            )}
          </div>
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
        <BackgroundLayer comp={comp} w={w} h={h} imgSrc={imgSrc} multiPlacements={multiPlacements} sphereRef={sphereRef} />
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <TemplateLayout
          slots={slots}
          captions={comp.captions}
          captionColors={comp.captionColors}
          captionHidden={comp.captionHidden}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        >
          {centeredTitle}
        </TemplateLayout>
      </div>
    </div>
  );
}
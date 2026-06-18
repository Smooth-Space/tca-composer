import { TEMPLATE_CAPTIONS, type Composition } from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";
import { TemplateLayout } from "@/components/TemplateLayout";
import { type MultiSphereHandle } from "@/components/MultiSphere";
import { BackgroundLayer, SplitImageRegion } from "@/components/ImageRegions";

// Templates B and C: shared caption layout, image layer behind text.
export function TemplateBC({
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
  const slots = TEMPLATE_CAPTIONS[comp.template];
  const centeredTitle = (
    <div className="flex h-full w-full flex-col items-center justify-center">{title}</div>
  );

  // C-split: image fills the full-width band between Text 1 (top) and Text 2 (bottom),
  // with 40px gaps; the centered title is overlaid on top of the image (no scrim).
  if (comp.template === "C" && comp.variant === "split") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <TemplateLayout
          slots={slots}
          captions={comp.captions}
          captionColors={comp.captionColors}
          captionHidden={comp.captionHidden}
          gap={40}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
          </div>
          <div style={{ position: "absolute", inset: 0 }}>{centeredTitle}</div>
        </TemplateLayout>
      </div>
    );
  }

  // split: middle is title + image in splitOrder, 40px gap.
  if (comp.variant === "split") {
    const titleHalf = (
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{centeredTitle}</div>
    );
    const imageHalf = (
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <SplitImageRegion comp={comp} imgSrc={imgSrc} sphereRef={sphereRef} />
      </div>
    );
    const middle = (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 40 }}>
        {comp.splitOrder === "image-first" ? (
          <>{imageHalf}{titleHalf}</>
        ) : (
          <>{titleHalf}{imageHalf}</>
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
          gap={40}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        >
          {middle}
        </TemplateLayout>
      </div>
    );
  }

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
          gap={comp.template === "B" ? 40 : 0}
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
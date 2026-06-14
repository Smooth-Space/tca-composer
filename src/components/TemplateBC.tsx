import { TEMPLATE_CAPTIONS, type Composition } from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";
import { TemplateLayout } from "@/components/TemplateLayout";
import { CoverImage, MultiImages, Overlay } from "@/components/ImageLayers";
import { MultiSphere } from "@/components/MultiSphere";

// Templates B and C: shared caption layout, image layer behind text.
export function TemplateBC({
  comp,
  w,
  h,
  imgSrc,
  title,
  multiPlacements,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  title: React.ReactNode;
  multiPlacements: Placement[];
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
          gap={40}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <CoverImage src={imgSrc} />
            <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
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
        <CoverImage src={imgSrc} />
        <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
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
        <TemplateLayout slots={slots} captions={comp.captions} captionColors={comp.captionColors} gap={40}>
          {middle}
        </TemplateLayout>
      </div>
    );
  }

  let imageLayer: React.ReactNode = null;
  if (comp.variant === "full") {
    imageLayer = (
      <div style={{ position: "absolute", inset: 0 }}>
        <CoverImage src={imgSrc} />
        <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
      </div>
    );
  } else if (comp.variant === "multi") {
    imageLayer = (
      <div style={{ position: "absolute", inset: 0 }}>
        {comp.animate ? (
          <MultiSphere
            images={comp.images}
            w={w}
            h={h}
            imageOverlay={comp.imageOverlay}
            animSeed={comp.animSeed}
            playing={comp.animPlaying}
          />
        ) : (
          <MultiImages images={comp.images} placements={multiPlacements} imageOverlay={comp.imageOverlay} />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {imageLayer && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>{imageLayer}</div>
      )}
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <TemplateLayout slots={slots} captions={comp.captions} captionColors={comp.captionColors} gap={comp.template === "B" ? 40 : 0}>
          {centeredTitle}
        </TemplateLayout>
      </div>
    </div>
  );
}
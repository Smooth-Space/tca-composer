import { TEMPLATE_CAPTIONS, type Composition } from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";
import { Caption } from "@/components/Caption";
import { TemplateLayout } from "@/components/TemplateLayout";
import { CoverImage, MultiImages, Overlay } from "@/components/ImageLayers";
import { MultiSphere } from "@/components/MultiSphere";

export function TemplateA({
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
        <CoverImage src={imgSrc} />
        <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />
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
              <Caption text={comp.captions[left.key]} color={comp.captionColors[left.key]} align="left" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {right && (
              <Caption text={comp.captions[right.key]} color={comp.captionColors[right.key]} align="left" />
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
        <TemplateLayout slots={slots} captions={comp.captions} captionColors={comp.captionColors}>
          {centeredTitle}
        </TemplateLayout>
      </div>
    </div>
  );
}
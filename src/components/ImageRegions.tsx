import type { Composition } from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";
import { CoverImage, MultiImages, Overlay } from "@/components/ImageLayers";
import { MultiSphere, type MultiSphereHandle } from "@/components/MultiSphere";
import { SplitConveyor } from "@/components/SplitConveyor";

// The full-frame background image layer for the none / full / multi variants.
// Returns null for "none" and "split" (split is handled structurally per template).
export function BackgroundLayer({
  comp,
  w,
  h,
  imgSrc,
  multiPlacements,
  sphereRef,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  multiPlacements: Placement[];
  sphereRef?: React.Ref<MultiSphereHandle>;
}) {
  if (comp.variant === "full") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <CoverImage src={imgSrc} />
        {imgSrc && <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />}
      </div>
    );
  }
  if (comp.variant === "multi") {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
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
          <MultiImages
            images={comp.images}
            placements={multiPlacements}
            imageOverlay={comp.imageOverlay}
          />
        )}
      </div>
    );
  }
  return null;
}

// The inner content of a split image region: the animated conveyor, or a cover image + overlay.
// Callers wrap this in their own positioned container (half / band / inset), unchanged.
export function SplitImageRegion({
  comp,
  imgSrc,
  sphereRef,
}: {
  comp: Composition;
  imgSrc: string;
  sphereRef?: React.Ref<MultiSphereHandle>;
}) {
  if (comp.animate) {
    return (
      <SplitConveyor
        ref={sphereRef}
        images={comp.images}
        imageOverlay={comp.imageOverlay}
        animSeed={comp.animSeed}
        playing={comp.animPlaying}
      />
    );
  }
  return (
    <>
      <CoverImage src={imgSrc} />
      {imgSrc && <Overlay opacity={comp.imageOverlay} style={{ inset: 0 }} />}
    </>
  );
}

import { PLACEHOLDER_COLOR, type ImageItem } from "@/lib/composition";
import type { Placement } from "@/lib/multiLayout";

// The cover-fill image used for full / split image layers.
export function CoverImage({ src }: { src: string }) {
  if (!src) {
    return <div style={{ width: "100%", height: "100%", background: PLACEHOLDER_COLOR }} />;
  }
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
      }}
    />
  );
}

// The black overlay div. Renders null when opacity <= 0.
export function Overlay({ opacity, style }: { opacity: number; style?: React.CSSProperties }) {
  if (opacity <= 0) return null;
  return <div style={{ position: "absolute", background: "#000", opacity, ...style }} />;
}

// The absolutely-positioned multi image + overlay map. Placements are precomputed by the caller.
export function MultiImages({
  images,
  placements,
  imageOverlay,
}: {
  images: ImageItem[];
  placements: Placement[];
  imageOverlay: number;
}) {
  return (
    <>
      {placements.map((p) => (
        <div
          key={p.id}
          style={{ position: "absolute", left: p.x, top: p.y, width: p.width, height: p.height }}
        >
          {images.length === 0 ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: PLACEHOLDER_COLOR,
                border: "1px solid #ececec",
              }}
            />
          ) : (
            <>
              <img
                src={images.find((im) => im.id === p.id)?.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <Overlay opacity={imageOverlay} style={{ inset: 0 }} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

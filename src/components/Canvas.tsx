import { PLACEHOLDER_SRC, type Composition } from "@/lib/composition";
import { useEffect, useMemo, useRef, useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { computeMultiLayout } from "@/lib/multiLayout";

const FORMAT_DIMENSIONS: Record<Composition["format"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

export function Canvas({
  comp,
  compositionRef,
}: {
  comp: Composition;
  compositionRef?: React.Ref<HTMLDivElement>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { w, h } = FORMAT_DIMENSIONS[comp.format];
  const imgSrc = comp.images[0]?.src ?? PLACEHOLDER_SRC;

  const multiPlacements = useMemo(
    () =>
      computeMultiLayout(
        comp.images,
        w,
        h,
        comp.titles.length,
        comp.titleSizePx,
        comp.multiSeed,
      ),
    [comp.images, w, h, comp.titles.length, comp.titleSizePx, comp.multiSeed],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const pad = 64;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      setScale(Math.min(availW / w, availH / h, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  const title = (
    <TitleBlock
      titles={comp.titles}
      titleMode={comp.titleMode}
      titleSeed={comp.titleSeed}
      titleSizePx={comp.titleSizePx}
      titleColor={comp.titleColor}
    />
  );

  const infoRow = (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
      {[comp.info.text1, comp.info.text2].map((text, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "'ABC Arizona Plus Variable'",
            fontSize: 36,
            lineHeight: 1.1,
            color: comp.textColor,
            fontVariationSettings: "'wght' 400, 'SRFF' 0, 'wdth' 100",
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );

  const coverImg = (
    <img
      src={imgSrc}
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

  const renderInner = () => {
    if (comp.variant === "full") {
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", inset: 0 }}>{coverImg}</div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="flex flex-1 flex-col justify-center">{title}</div>
            {infoRow}
          </div>
        </div>
      );
    }

    if (comp.variant === "multi") {
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            {multiPlacements.map((p) => (
              <img
                key={p.id}
                src={comp.images.find((im) => im.id === p.id)?.src}
                alt=""
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  width: p.width,
                  height: p.height,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              padding: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="flex flex-1 flex-col justify-center">{title}</div>
            {infoRow}
          </div>
        </div>
      );
    }

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
          {coverImg}
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
              padding: imageTop ? "40px 40px 130px 40px" : "40px",
              boxSizing: "border-box",
            } as React.CSSProperties
          }
        >
          {title}
        </div>
      );
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          {imageHalf}
          {titleHalf}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 40 }}>
            {infoRow}
          </div>
        </div>
      );
    }

    // none
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div className="flex flex-1 flex-col justify-center">{title}</div>
        {infoRow}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-muted"
    >
      <div style={{ width: w * scale, height: h * scale }} className="shadow-2xl">
        <div
          ref={compositionRef}
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: comp.background,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {renderInner()}
        </div>
      </div>
    </div>
  );
}

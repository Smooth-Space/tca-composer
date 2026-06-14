import { PLACEHOLDER_SRC, TEMPLATE_CAPTIONS, type Composition } from "@/lib/composition";
import { useEffect, useMemo, useRef, useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { TemplateLayout } from "@/components/TemplateLayout";
import { computeMultiLayout } from "@/lib/multiLayout";
import { computeAxes, type Axes } from "@/lib/engine";

const FORMAT_DIMENSIONS: Record<Composition["format"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

function TitleLine({
  text,
  axes,
  startOffset,
  titleSizePx,
  color,
}: {
  text: string;
  axes: Axes[];
  startOffset: number;
  titleSizePx: number;
  color: string;
}) {
  const chars = Array.from(text);
  return (
    <div
      style={{
        lineHeight: 0.9,
        textAlign: "center",
        fontFamily: "'ABC Arizona Plus Variable'",
        fontSize: titleSizePx,
        letterSpacing: "-0.02em",
        color,
      }}
    >
      <div
        style={{
          width: "fit-content",
          maxWidth: "100%",
          marginLeft: "auto",
          marginRight: "auto",
          whiteSpace: "normal",
          overflowWrap: "normal",
          wordBreak: "normal",
          hyphens: "none",
        }}
      >
        {chars.length === 0
          ? "\u00A0"
          : chars.map((ch, i) => {
              const a = axes[startOffset + i];
              return (
                <span
                  key={i}
                  style={{
                    display: "inline",
                    fontVariationSettings: a
                      ? `'wght' ${a.wght}, 'SRFF' ${a.SRFF}, 'wdth' ${a.wdth}`
                      : undefined,
                  }}
                >
                  {ch}
                </span>
              );
            })}
      </div>
    </div>
  );
}

function TemplateD({
  comp,
  w,
  h,
  imgSrc,
  coverImg,
}: {
  comp: Composition;
  w: number;
  h: number;
  imgSrc: string;
  coverImg: React.ReactNode;
}) {
  const dRows = useMemo(
    () => [comp.titles[0]?.text ?? "", comp.titles[1]?.text ?? ""],
    [comp.titles],
  );
  const dAxes = useMemo(
    () => computeAxes(dRows.flatMap((r) => Array.from(r)), comp.titleMode, comp.titleSeed),
    [dRows, comp.titleMode, comp.titleSeed],
  );
  const bottomOffset = Array.from(dRows[0]).length;

  const multiPlacements = useMemo(
    () => computeMultiLayout(comp.images, w, h, 2, comp.titleSizePx, comp.multiSeed, 0),
    [comp.images, w, h, comp.titleSizePx, comp.multiSeed],
  );

  const overlay = (style: React.CSSProperties) =>
    comp.imageOverlay > 0 ? (
      <div
        style={{ position: "absolute", background: "#000", opacity: comp.imageOverlay, ...style }}
      />
    ) : null;

  const caption = (
    text: string,
    color: string,
    align: "left" | "right" = "left",
  ) => (
    <div
      style={{
        flex: 1,
        textAlign: align,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily: "'ABC Arizona Plus Variable'",
        fontSize: 36,
        lineHeight: 1.1,
        color,
        fontVariationSettings: "'wght' 400, 'SRFF' 0, 'wdth' 100",
      }}
    >
      {text}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {comp.variant === "full" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {coverImg}
          {overlay({ inset: 0 })}
        </div>
      )}
      {comp.variant === "multi" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {multiPlacements.map((p) => (
            <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.width, height: p.height }}>
              <img
                src={comp.images.find((im) => im.id === p.id)?.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {overlay({ inset: 0 })}
            </div>
          ))}
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
        <TitleLine
          text={dRows[0]}
          axes={dAxes}
          startOffset={0}
          titleSizePx={comp.titleSizePx}
          color={comp.titleColor}
        />

        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {comp.variant === "split" && (
            <div style={{ position: "absolute", inset: 0 }}>
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
              {overlay({ inset: 0 })}
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
            {caption(comp.captions.text1, comp.captionColors.text1, "left")}
            {caption(comp.captions.text2, comp.captionColors.text2, "right")}
          </div>
        </div>

        <TitleLine
          text={dRows[1]}
          axes={dAxes}
          startOffset={bottomOffset}
          titleSizePx={comp.titleSizePx}
          color={comp.titleColor}
        />
      </div>
    </div>
  );
}

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
      titleSizeMode={comp.titleSizeMode}
      titleShift={comp.titleShift}
      titleShiftSeed={comp.titleShiftSeed}
      contentWidthPx={w - 80}
    />
  );

  const infoRow = (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
      {([
        [comp.captions.text1, comp.captionColors.text1],
        [comp.captions.text2, comp.captionColors.text2],
      ] as const).map(([text, color], i) => (
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
            color,
            fontVariationSettings: "'wght' 400, 'SRFF' 0, 'wdth' 100",
          }}
        >
          {text}
        </div>
      ))}
    </div>
  );

  const overlay = (style: React.CSSProperties) =>
    comp.imageOverlay > 0 ? (
      <div
        style={{ position: "absolute", background: "#000", opacity: comp.imageOverlay, ...style }}
      />
    ) : null;

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
    if (comp.template === "D") {
      return <TemplateD comp={comp} w={w} h={h} imgSrc={imgSrc} coverImg={coverImg} />;
    }
    if (comp.template !== "A") {
      return renderTemplate();
    }
    if (comp.variant === "full") {
      return (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {coverImg}
            {overlay({ inset: 0 })}
          </div>
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
              <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.width, height: p.height }}>
                <img
                  src={comp.images.find((im) => im.id === p.id)?.src}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {overlay({ inset: 0 })}
              </div>
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
          {overlay({ inset: 0 })}
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

  // Templates B and C: shared caption layout, image layer behind text.
  const renderTemplate = () => {
    const slots = TEMPLATE_CAPTIONS[comp.template];
    const centeredTitle = (
      <div className="flex h-full w-full flex-col items-center justify-center">{title}</div>
    );

    // C-split: middle is title + image in splitOrder, 40px gap.
    if (comp.variant === "split") {
      const titleHalf = (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {centeredTitle}
        </div>
      );
      const imageHalf = (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {coverImg}
          {overlay({ inset: 0 })}
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
          {coverImg}
          {overlay({ inset: 0 })}
        </div>
      );
    } else if (comp.variant === "inset") {
      const side = w - 280;
      imageLayer = (
        <div
          style={{
            position: "absolute",
            left: (w - side) / 2,
            top: (h - side) / 2,
            width: side,
            height: side,
          }}
        >
          {coverImg}
          {overlay({ inset: 0 })}
        </div>
      );
    } else if (comp.variant === "multi") {
      imageLayer = (
        <div style={{ position: "absolute", inset: 0 }}>
          {multiPlacements.map((p) => (
            <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.width, height: p.height }}>
              <img
                src={comp.images.find((im) => im.id === p.id)?.src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {overlay({ inset: 0 })}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ position: "absolute", inset: 0 }}>
        {imageLayer && (
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>{imageLayer}</div>
        )}
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <TemplateLayout slots={slots} captions={comp.captions} captionColors={comp.captionColors} gap={comp.template === "C" ? 40 : 0}>
            {centeredTitle}
          </TemplateLayout>
        </div>
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

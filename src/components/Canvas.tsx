import type { Composition } from "@/lib/composition";
import { useEffect, useRef, useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";

const FORMAT_DIMENSIONS: Record<Composition["format"], { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

export function Canvas({ comp }: { comp: Composition }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { w, h } = FORMAT_DIMENSIONS[comp.format];

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

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-muted"
    >
      <div
        style={{
          width: w * scale,
          height: h * scale,
        }}
        className="shadow-2xl"
      >
        <div
          style={{
            width: w,
            height: h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: comp.background,
            padding: 40,
          }}
          className="flex flex-col justify-between"
        >
          {/* Title block */}
          <div className="flex flex-1 flex-col justify-center">
            <TitleBlock
              titles={comp.titles}
              titleMode={comp.titleMode}
              titleSeed={comp.titleSeed}
              titleSizePx={comp.titleSizePx}
              color={comp.textColor}
            />
          </div>

          {/* Info row */}
          <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
            {[comp.info.text1, comp.info.text2].map((text, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: "left",
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
        </div>
      </div>
    </div>
  );
}
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAxes, makeRng, type Mode } from "@/lib/engine";
import type { Title } from "@/lib/composition";

interface TitleBlockProps {
  titles: Title[];
  titleMode: Mode;
  titleSeed: number;
  titleSizePx: number;
  titleColor: string;
  titleSizeMode?: "fixed" | "fit";
  titleShift?: boolean;
  titleShiftSeed?: number;
  contentWidthPx?: number;
}

const FIT_REF_SIZE = 200;

export function TitleBlock({
  titles,
  titleMode,
  titleSeed,
  titleSizePx,
  titleColor,
  titleSizeMode = "fixed",
  titleShift = false,
  titleShiftSeed = 0,
  contentWidthPx = 1000,
}: TitleBlockProps) {
  const rows = useMemo(() => titles.map((t) => t.text), [titles]);

  // One flat stream across ALL rows; axes computed once.
  const axes = useMemo(() => {
    const stream = rows.flatMap((r) => Array.from(r)); // spaces included, in order
    return computeAxes(stream, titleMode, titleSeed);
  }, [rows, titleMode, titleSeed]);

  // Start index of each row within the flat stream (no mutable counter in JSX).
  const rowStart = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const r of rows) {
      starts.push(acc);
      acc += Array.from(r).length;
    }
    return starts;
  }, [rows]);

  const fitEnabled = titleSizeMode === "fit" && rows.length === 1;
  const shiftEnabled = titleShift && rows.length >= 2;

  const offsets = useMemo(() => {
    if (!shiftEnabled) return rows.map(() => 0.5);
    const rng = makeRng(titleShiftSeed);
    return rows.map(() => rng());
  }, [shiftEnabled, titleShiftSeed, rows]);

  // ---- Fit measuring ----
  const measureRef = useRef<HTMLDivElement>(null);
  const [fittedSize, setFittedSize] = useState(titleSizePx);

  useLayoutEffect(() => {
    if (!fitEnabled) return;
    let cancelled = false;
    const measure = () => {
      const el = measureRef.current;
      if (!el || cancelled) return;
      const w = el.getBoundingClientRect().width;
      if (w > 0) setFittedSize(FIT_REF_SIZE * (contentWidthPx / w));
    };
    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }
    return () => {
      cancelled = true;
    };
  }, [fitEnabled, rows, titleMode, titleSeed, contentWidthPx]);

  const renderSize = fitEnabled ? fittedSize : titleSizePx;

  const renderSpans = (row: string, r: number) => {
    const chars = Array.from(row);
    if (chars.length === 0) return "\u00A0";
    return chars.map((ch, i) => {
      const a = axes[rowStart[r] + i];
      return (
        <span
          key={i}
          style={{
            display: "inline",
            fontVariationSettings: `'wght' ${a.wght}, 'SRFF' ${a.SRFF}, 'wdth' ${a.wdth}`,
          }}
        >
          {ch}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        lineHeight: 0.9,
        textAlign: "center",
        fontFamily: "'ABC Arizona Plus Variable'",
        fontSize: renderSize,
        letterSpacing: "-0.02em",
        color: titleColor,
      }}
    >
      {fitEnabled && (
        <div
          ref={measureRef}
          aria-hidden
          style={{
            position: "absolute",
            left: -99999,
            top: 0,
            visibility: "hidden",
            whiteSpace: "nowrap",
            fontSize: FIT_REF_SIZE,
            letterSpacing: "-0.02em",
            fontFamily: "'ABC Arizona Plus Variable'",
          }}
        >
          {renderSpans(rows[0], 0)}
        </div>
      )}
      {rows.map((row, r) => {
        const lineInner = (
          <div
            style={{
              width: shiftEnabled ? undefined : "fit-content",
              maxWidth: "100%",
              marginLeft: shiftEnabled ? undefined : "auto",
              marginRight: shiftEnabled ? undefined : "auto",
              flex: shiftEnabled ? "0 0 auto" : undefined,
              whiteSpace: fitEnabled ? "nowrap" : "normal",
              overflowWrap: "normal",
              wordBreak: "normal",
              hyphens: "none",
            }}
          >
            {renderSpans(row, r)}
          </div>
        );
        if (shiftEnabled) {
          return (
            <div key={titles[r].id} style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: `${offsets[r]} 0 0px` }} />
              {lineInner}
              <div style={{ flex: `${1 - offsets[r]} 0 0px` }} />
            </div>
          );
        }
        return <div key={titles[r].id}>{lineInner}</div>;
      })}
    </div>
  );
}
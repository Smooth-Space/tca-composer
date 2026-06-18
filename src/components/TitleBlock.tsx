import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAxes, type Mode } from "@/lib/engine";
import type { Title } from "@/lib/composition";
import { TitleSpans } from "@/components/TitleLine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT, shiftOffsets } from "@/lib/typo";
import { useSelectable } from "@/components/SelectionContext";

interface TitleBlockProps {
  titles: Title[];
  titleMode: Mode;
  titleSeed: number;
  titleAmplitude?: number | null;
  titlePhase?: number | null;
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
  titleAmplitude = null,
  titlePhase = null,
  titleSizePx,
  titleColor,
  titleSizeMode = "fixed",
  titleShift = false,
  titleShiftSeed = 0,
  contentWidthPx = 1000,
}: TitleBlockProps) {
  const { handleClick, handleDoubleClick, hideSelection, selectableStyle } = useSelectable(
    titles[0]?.id ?? null,
  );
  // A/B/C use one multi-line title field (titles[0]) only.
  const t0 = titles[0];
  const lines = useMemo(
    () =>
      (t0?.text ?? "")
        .split("\n")
        .map((text, i) => ({ text, titleId: t0?.id, key: `${t0?.id ?? "t"}-${i}` })),
    [t0],
  );
  const rows = useMemo(() => lines.map((l) => l.text), [lines]);

  // One flat stream across the single field's rows; axes computed once (newlines excluded).
  const axes = useMemo(
    () =>
      computeAxes(Array.from((t0?.text ?? "").replace(/\n/g, "")), titleMode, titleSeed, {
        amplitude: titleAmplitude,
        phase: titlePhase,
      }),
    [t0, titleMode, titleSeed, titleAmplitude, titlePhase],
  );

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

  const offsets = useMemo(
    () => shiftOffsets(rows.length, titleShiftSeed),
    [rows.length, titleShiftSeed],
  );

  // ---- Fit measuring (ratio of two measurements in the same scaled space) ----
  const measRef = useRef<HTMLDivElement>(null); // hidden reference line at REF_SIZE
  const contentRef = useRef<HTMLDivElement>(null); // content-width container (canvas − margins)
  const [fittedSize, setFittedSize] = useState(titleSizePx);

  useLayoutEffect(() => {
    if (!fitEnabled) return;
    let active = true;
    const measure = () => {
      if (!active || !measRef.current || !contentRef.current) return;
      const lineW = measRef.current.getBoundingClientRect().width; // display px
      const contentW = contentRef.current.getBoundingClientRect().width; // same space
      if (lineW > 0 && contentW > 0) setFittedSize(FIT_REF_SIZE * (contentW / lineW)); // scale-free
    };
    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }
    return () => {
      active = false;
    };
  }, [fitEnabled, rows, titleMode, titleSeed, contentWidthPx]);

  const renderSize = fitEnabled ? fittedSize : titleSizePx;

  const renderSpans = (row: string, r: number) => (
    <TitleSpans text={row} axes={axes} startOffset={rowStart[r]} />
  );

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: "100%",
        lineHeight: TITLE_LINE_HEIGHT,
        textAlign: "center",
        fontFamily: TITLE_FONT,
        fontSize: renderSize,
        letterSpacing: TITLE_LETTER_SPACING,
        color: titleColor,
        ...selectableStyle,
      }}
    >
      {titles[0]?.text === "" && !hideSelection && (
        <span style={{ opacity: 0.3 }}>Title</span>
      )}
      {fitEnabled && (
        <>
          {/* content-width reference (canvas inner width); measured in same scaled space */}
          <div
            ref={contentRef}
            aria-hidden
            style={{
              position: "absolute",
              left: -99999,
              top: 0,
              height: 0,
              visibility: "hidden",
              width: contentWidthPx,
            }}
          />
          {/* hidden reference line at REF_SIZE, same chars/axes/letter-spacing */}
          <div
            ref={measRef}
            aria-hidden
            style={{
              position: "absolute",
              left: -99999,
              top: 0,
              visibility: "hidden",
              whiteSpace: "nowrap",
              fontSize: FIT_REF_SIZE,
              letterSpacing: TITLE_LETTER_SPACING,
              fontFamily: TITLE_FONT,
            }}
          >
            {renderSpans(rows[0], 0)}
          </div>
        </>
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
            <div key={lines[r].key} style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: `${offsets[r]} 0 0px` }} />
              {lineInner}
              <div style={{ flex: `${1 - offsets[r]} 0 0px` }} />
            </div>
          );
        }
        return <div key={lines[r].key}>{lineInner}</div>;
      })}
    </div>
  );
}
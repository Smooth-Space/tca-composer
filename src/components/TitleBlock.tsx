import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAxes, makeRng, type Mode } from "@/lib/engine";
import type { Title } from "@/lib/composition";
import { TitleSpans } from "@/components/TitleLine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT } from "@/lib/typo";

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

// Evenly-spread, seed-shuffled offsets so lines clearly reach toward both margins.
function shiftOffsets(n: number, seed: number): number[] {
  if (n <= 1) return [0.5];
  const rng = makeRng(seed);
  const base = Array.from({ length: n }, (_, i) => i / (n - 1)); // evenly spread 0..1
  for (let i = n - 1; i > 0; i--) {
    // seeded shuffle
    const j = Math.floor(rng() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  const spacing = 1 / (n - 1);
  return base.map((v) => Math.min(1, Math.max(0, v + (rng() * 2 - 1) * spacing * 0.25))); // light jitter
}

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
  // Split each title on "\n" into rendered rows, keeping the parent title id.
  const lines = useMemo(
    () =>
      titles.flatMap((t) =>
        t.text.split("\n").map((text, i) => ({ text, titleId: t.id, key: `${t.id}-${i}` })),
      ),
    [titles],
  );
  const rows = useMemo(() => lines.map((l) => l.text), [lines]);

  // One flat stream across ALL rows; axes computed once (newlines excluded).
  const axes = useMemo(() => {
    const stream = titles.flatMap((t) => Array.from(t.text.replace(/\n/g, "")));
    return computeAxes(stream, titleMode, titleSeed);
  }, [titles, titleMode, titleSeed]);

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
      style={{
        width: "100%",
        lineHeight: TITLE_LINE_HEIGHT,
        textAlign: "center",
        fontFamily: TITLE_FONT,
        fontSize: renderSize,
        letterSpacing: TITLE_LETTER_SPACING,
        color: titleColor,
      }}
    >
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
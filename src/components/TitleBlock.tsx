import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAxes, type Mode } from "@/lib/engine";
import type { Title } from "@/lib/composition";
import { TitleSpans } from "@/components/TitleLine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT, shiftOffsets } from "@/lib/typo";
import { useSelectable } from "@/components/SelectionContext";
import { useTitleSpanAnimation } from "@/lib/titleAnim";

interface TitleBlockProps {
  titles: Title[];
  titleMode: Mode;
  titleSeed: number;
  titleAmplitude?: number | null;
  titlePhase?: number | null;
  titleAnimate?: boolean;
  titleAnimPlaying?: boolean;
  titleBasePhase?: number;
  exportPhase?: number | null;
  titleSizePx: number;
  titleColor: string;
  titleSizeMode?: "fixed" | "fit";
  titleShift?: boolean;
  titleShiftSeed?: number;
  titleShiftAmount?: number;
  contentWidthPx?: number;
}

const FIT_REF_SIZE = 200;

export function TitleBlock({
  titles,
  titleMode,
  titleSeed,
  titleAmplitude = null,
  titlePhase = null,
  titleAnimate = false,
  titleAnimPlaying = true,
  titleBasePhase = 0,
  exportPhase = null,
  titleSizePx,
  titleColor,
  titleSizeMode = "fixed",
  titleShift = false,
  titleShiftSeed = 0,
  titleShiftAmount = 1,
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

  // Heavy mode is excluded from animation (its narrow axis ranges animate poorly),
  // so a saved `titleAnimate: true` in Heavy renders statically.
  const animActive = titleAnimate && titleMode !== "heavy";

  const rootRef = useRef<HTMLDivElement>(null);
  // Flat character stream (newlines excluded), shared by the static render and
  // the live rAF DOM-writer so span indices line up 1:1.
  const flatChars = useMemo(() => Array.from((t0?.text ?? "").replace(/\n/g, "")), [t0]);

  // The live loop writes font-variation-settings straight to the spans during
  // playback (no per-frame React render). React state (committedPhase) only
  // covers the static/paused/export renders below.
  const committedPhase = useTitleSpanAnimation({
    rootRef,
    animActive,
    playing: titleAnimPlaying,
    exportPhase,
    basePhase: titleBasePhase,
    flatChars,
    mode: titleMode,
    seed: titleSeed,
    amplitude: titleAmplitude,
  });

  // Phase used for the React-rendered spans: explicit export phase wins (frozen,
  // deterministic frames); otherwise the committed animation phase when active;
  // otherwise the static titlePhase. Static behaviour is unchanged.
  const reactPhase = exportPhase !== null ? exportPhase : animActive ? committedPhase : titlePhase;

  const axes = useMemo(
    () =>
      computeAxes(flatChars, titleMode, titleSeed, {
        amplitude: titleAmplitude,
        phase: reactPhase,
        forceDistribution: animActive && titleMode === "mixed" ? "sine" : undefined,
        forceAmplitude: animActive && titleMode !== "mixed" ? 1 : undefined,
        round: animActive ? false : undefined,
      }),
    [flatChars, titleMode, titleSeed, titleAmplitude, reactPhase, animActive],
  );

  // Constant base-phase axes, consulted only for whitespace in the animated path.
  // Holding a space's variation at the base phase keeps its advance fixed while
  // letters animate, so word boundaries don't reflow sub-pixel frame to frame.
  // Same params as `axes` but locked to titleBasePhase.
  const baseAxes = useMemo(
    () =>
      computeAxes(flatChars, titleMode, titleSeed, {
        amplitude: titleAmplitude,
        phase: titleBasePhase,
        forceDistribution: animActive && titleMode === "mixed" ? "sine" : undefined,
        forceAmplitude: animActive && titleMode !== "mixed" ? 1 : undefined,
        round: animActive ? false : undefined,
      }),
    [flatChars, titleMode, titleSeed, titleAmplitude, titleBasePhase, animActive],
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
    () => shiftOffsets(rows.length, titleShiftSeed, titleShiftAmount),
    [rows.length, titleShiftSeed, titleShiftAmount],
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

  // Per-letter box pinning for the animated path: measure each glyph's natural
  // (committed-phase) advance and lock the inline-block box to it, so the boxes —
  // and therefore every letter's position — stay fixed while the axes animate.
  // The glyph itself is left-anchored within its box (see TitleLine) and spills
  // via overflow:visible, so its drawing origin never moves frame-to-frame.
  // Cleared when inactive.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-tspan]"));
    if (!animActive || spans.length === 0) {
      spans.forEach((el) => (el.style.width = ""));
      return;
    }
    // Only pin letter boxes — whitespace stays natural inline (data-tspace) so
    // its advance isn't collapsed to a measured zero-width box.
    const letters = spans.filter((el) => el.dataset.tspace === undefined);
    letters.forEach((el) => (el.style.width = ""));
    const widths = letters.map((el) => el.offsetWidth);
    letters.forEach((el, i) => (el.style.width = `${widths[i]}px`));
    return () => letters.forEach((el) => (el.style.width = ""));
  }, [animActive, flatChars, titleMode, titleSeed, titleAmplitude, renderSize, shiftEnabled]);

  const renderSpans = (row: string, r: number, animatable = false) => (
    <TitleSpans
      text={row}
      axes={axes}
      startOffset={rowStart[r]}
      animatable={animatable}
      spaceAxes={animatable ? baseAxes : undefined}
    />
  );

  return (
    <div
      ref={rootRef}
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
        <span
          aria-hidden="true"
          style={{
            visibility: "hidden",
            fontSize: renderSize,
            fontFamily: TITLE_FONT,
            letterSpacing: TITLE_LETTER_SPACING,
            lineHeight: TITLE_LINE_HEIGHT,
          }}
        >
          {"\u00A0"}
        </span>
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
      {/* visible rows below pass animatable={animActive} */}
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
            {renderSpans(row, r, animActive)}
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

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeAxes, type Mode } from "@/lib/engine";
import { titleDisplay, applyItalic } from "@/lib/titleItalic";
import type { Title, Align } from "@/lib/composition";
import { TitleSpans } from "@/components/TitleLine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT, shiftOffsets } from "@/lib/typo";
import { useSelectable } from "@/components/SelectionContext";

interface TitleBlockProps {
  titles: Title[];
  titleMode: Mode;
  titleSeed: number;
  titleAmplitude?: number | null;
  titlePhase?: number | null;
  titleAnimate?: boolean;
  titleBasePhase?: number;
  exportPhase?: number | null;
  fontsReady?: boolean;
  titleSizePx: number;
  titleColor: string;
  titleSizeMode?: "fixed" | "fit";
  titleShift?: boolean;
  titleShiftSeed?: number;
  titleShiftAmount?: number;
  contentWidthPx?: number;
  // Freeform only. Defaults to "center" so Templates A/D, which don't pass it,
  // render exactly as they did before alignment existed.
  align?: Align;
}

const FIT_REF_SIZE = 200;

export function TitleBlock({
  titles,
  titleMode,
  titleSeed,
  titleAmplitude = null,
  titlePhase = null,
  titleAnimate = false,
  titleBasePhase = 0,
  exportPhase = null,
  fontsReady = false,
  titleSizePx,
  titleColor,
  titleSizeMode = "fixed",
  titleShift = false,
  titleShiftSeed = 0,
  titleShiftAmount = 1,
  contentWidthPx = 1000,
  align = "center",
}: TitleBlockProps) {
  const { handleClick, handleDoubleClick, hideSelection, selectableStyle } = useSelectable(
    titles[0]?.id ?? null,
  );
  // A/B/C use one multi-line title field (titles[0]) only.
  const t0 = titles[0];
  // titleDisplay strips inline-italic markup and applies Mixed-mode uppercase (both
  // display-only — the stored text is never mutated), returning rows, the flat
  // character stream, and italic flags aligned 1:1 with it. Shared with freeformSvg
  // so the CSS and glyph-path renderers cannot drift.
  const rawText = t0?.text ?? "";
  const display = useMemo(() => titleDisplay(rawText, titleMode === "mixed"), [rawText, titleMode]);
  const rows = display.rows;
  const lines = useMemo(
    () => rows.map((text, i) => ({ text, titleId: t0?.id, key: `${t0?.id ?? "t"}-${i}` })),
    [rows, t0?.id],
  );

  // Heavy mode is excluded from animation (its narrow axis ranges animate poorly),
  // so a saved `titleAnimate: true` in Heavy renders statically.
  const animActive = titleAnimate && titleMode !== "heavy";

  const rootRef = useRef<HTMLDivElement>(null);
  // Flat character stream (newlines excluded), shared by the static render and
  // the live rAF DOM-writer so span indices line up 1:1.
  const flatChars = display.flatChars;
  const flatItalic = display.flatItalic;

  // Live playback was removed (the per-frame rAF loop was unstable). The canvas
  // now always renders a single static frame; only MP4 export animates, by driving
  // exportPhase through a normal React render per frame.
  //
  // Phase used for the React-rendered spans: explicit export phase wins (frozen,
  // deterministic frames); otherwise the animation-ready static frame at the base
  // phase when the toggle is on; otherwise the static titlePhase. Unchanged for
  // non-animated titles.
  const reactPhase = exportPhase !== null ? exportPhase : animActive ? titleBasePhase : titlePhase;

  // Slant is overlaid AFTER the wave, never fed into it: computeAxes sees only the
  // clean character stream, so italic markup can never shift wght/SRFF.
  const axes = useMemo(
    () =>
      applyItalic(
        computeAxes(flatChars, titleMode, titleSeed, {
          amplitude: titleAmplitude,
          phase: reactPhase,
          forceDistribution: animActive && titleMode === "mixed" ? "sine" : undefined,
          forceAmplitude: animActive && titleMode !== "mixed" ? 1 : undefined,
          round: animActive ? false : undefined,
        }),
        flatItalic,
      ),
    [flatChars, flatItalic, titleMode, titleSeed, titleAmplitude, reactPhase, animActive],
  );

  // Constant base-phase axes, consulted only for whitespace in the animated path.
  // Holding a space's variation at the base phase keeps its advance fixed while
  // letters animate, so word boundaries don't reflow sub-pixel frame to frame.
  // Same params as `axes` but locked to titleBasePhase.
  const baseAxes = useMemo(
    () =>
      applyItalic(
        computeAxes(flatChars, titleMode, titleSeed, {
          amplitude: titleAmplitude,
          phase: titleBasePhase,
          forceDistribution: animActive && titleMode === "mixed" ? "sine" : undefined,
          forceAmplitude: animActive && titleMode !== "mixed" ? 1 : undefined,
          round: animActive ? false : undefined,
        }),
        flatItalic,
      ),
    [flatChars, flatItalic, titleMode, titleSeed, titleAmplitude, titleBasePhase, animActive],
  );

  // Start index of each row within the flat stream.
  const rowStart = display.rowStart;

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
    // flatItalic/amplitude/phase belong here: they change glyph advances (italic
    // is ~2% narrower) without changing the row text, so omitting them left a
    // fitted line at a stale size after italicising or rerolling the wave.
  }, [
    fitEnabled,
    rows,
    titleMode,
    titleSeed,
    contentWidthPx,
    flatItalic,
    titleAmplitude,
    titlePhase,
  ]);

  const renderSize = fitEnabled ? fittedSize : titleSizePx;

  // Per-letter box pinning for the animated path: measure each letter's natural
  // (committed-phase) advance and lock the inline-block box to it, so the boxes —
  // and therefore the line's layout — stay fixed while the axes animate. The
  // measured width is the outer box's offsetWidth, which equals the in-flow strut's
  // advance (the abspos centered glyph is excluded from layout — see TitleLine).
  // The visible glyph is centered in this fixed box and pivots from its own centre.
  // Cleared when inactive.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-tspan]"));
    // Only pin once fonts are ready — measuring with a fallback face would lock in
    // wrong advances. Re-runs when fontsReady flips, re-measuring with the real font.
    if (!animActive || !fontsReady || spans.length === 0) {
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
  }, [
    animActive,
    fontsReady,
    flatChars,
    titleMode,
    titleSeed,
    titleAmplitude,
    renderSize,
    shiftEnabled,
  ]);

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
        // Governs where the lines of a SOFT-WRAPPED row sit inside the row box.
        // The row box's own placement is set by its margins below — both are
        // needed, and they must agree.
        textAlign: align,
        fontFamily: TITLE_FONT,
        fontSize: renderSize,
        letterSpacing: TITLE_LETTER_SPACING,
        color: titleColor,
        ...selectableStyle,
      }}
    >
      {display.text === "" && !hideSelection && (
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
      {/* data-title-rows scopes the SVG exporter's line-break query to the VISIBLE
          rows, excluding the hidden fit-measurement line and the empty placeholder
          above — both of which also contain character spans. */}
      <div data-title-rows="">
        {/* Visible rows are animatable (three-node box-pinned structure) ONLY during
            export (exportPhase set); the live canvas always renders the static path. */}
        {rows.map((row, r) => {
          const lineInner = (
            <div
              style={{
                width: shiftEnabled ? undefined : "fit-content",
                maxWidth: "100%",
                // Places the row BOX within the full width. Shift drives its own
                // offset via the flex spacers below, so it opts out entirely.
                marginLeft: shiftEnabled ? undefined : align === "left" ? 0 : "auto",
                marginRight: shiftEnabled ? undefined : align === "right" ? 0 : "auto",
                flex: shiftEnabled ? "0 0 auto" : undefined,
                whiteSpace: fitEnabled ? "nowrap" : "normal",
                overflowWrap: "normal",
                wordBreak: "normal",
                hyphens: "none",
              }}
            >
              {renderSpans(row, r, animActive && exportPhase !== null)}
            </div>
          );
          if (shiftEnabled) {
            return (
              <div key={lines[r].key} style={{ display: "flex", width: "100%" }}>
                <div style={{ flex: `${offsets[r]} 0 0px`, transition: "flex 400ms ease" }} />
                {lineInner}
                <div style={{ flex: `${1 - offsets[r]} 0 0px`, transition: "flex 400ms ease" }} />
              </div>
            );
          }
          return <div key={lines[r].key}>{lineInner}</div>;
        })}
      </div>
    </div>
  );
}

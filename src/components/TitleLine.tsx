import { axesToCss, type Axes } from "@/lib/engine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT } from "@/lib/typo";

// Per-character spans for one line of title text. Shared by TitleBlock (A/B/C)
// and the single-line TitleLine used by Template D.
//
// `animatable` (set only for the live title-animation path) marks each letter with
// data-tspan and gives it a three-node structure that decouples the visual glyph
// from its layout footprint:
//
//   outer [data-tspan]   inline-block, width pinned by TitleBlock → fixed footprint,
//                         position:relative, overflow:visible, carries fvs
//     strut              in-flow copy, visibility:hidden → sets height + baseline,
//                         draws nothing (keeps the line on the exact static baseline)
//     glyph [data-tglyph] position:absolute, left:50% + translateX(-50%) → centered on
//                         its own box, pivoting from its own centre as the advance
//                         animates; transforms are sub-pixel composited (not
//                         pixel-snapped) so re-centering glides without jitter
//
// font-variation-settings is an inherited property, so the rAF writer keeps setting
// it on the outer [data-tspan] and both strut + glyph inherit it (the strut animates
// too but is hidden and width-pinned, so it's harmless). Static rendering keeps plain
// inline spans.
export function TitleSpans({
  text,
  axes,
  startOffset,
  animatable = false,
  spaceAxes,
}: {
  text: string;
  axes: Axes[];
  startOffset: number;
  animatable?: boolean;
  // Constant base-phase axes used only for animated whitespace, so a space's
  // advance stays fixed while letters animate. Falls back to `axes` when absent.
  spaceAxes?: Axes[];
}) {
  const chars = Array.from(text);
  if (chars.length === 0) return <>{"\u00A0"}</>;
  return (
    <>
      {chars.map((ch, i) => {
        const a = axes[startOffset + i];
        const isSpace = /\s/.test(ch);
        // Whitespace holds a constant (base-phase) variation; letters animate.
        const spaceA = spaceAxes?.[startOffset + i] ?? a;

        // Animated letter: pinned-width outer box (fixed footprint) + hidden
        // in-flow strut (baseline/height) + abspos centered glyph (pivots from
        // its own centre via translateX(-50%), sub-pixel composited → no jitter).
        if (animatable && !isSpace) {
          return (
            <span
              key={i}
              data-tspan=""
              style={{
                display: "inline-block",
                position: "relative",
                overflow: "visible",
                fontVariationSettings: a ? axesToCss(a) : undefined,
              }}
            >
              <span aria-hidden="true" style={{ visibility: "hidden" }}>
                {ch}
              </span>
              <span
                data-tglyph=""
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  transform: "translateX(-50%)",
                  whiteSpace: "pre",
                }}
              >
                {ch}
              </span>
            </span>
          );
        }

        // Animated whitespace stays normal inline text (white-space: pre so it
        // can't collapse) and frozen at its base-phase variation (data-tspace →
        // the rAF writer skips it), so word boundaries don't reflow. It still
        // carries data-tspan so the writer's index stays aligned with the axes.
        if (animatable && isSpace) {
          return (
            <span
              key={i}
              data-tspan=""
              data-tspace=""
              style={{
                display: "inline",
                whiteSpace: "pre",
                fontVariationSettings: spaceA ? axesToCss(spaceA) : undefined,
              }}
            >
              {ch}
            </span>
          );
        }

        // Static / non-animatable (also Template D + fit-measurement): plain inline.
        return (
          <span
            key={i}
            style={{ display: "inline", fontVariationSettings: a ? axesToCss(a) : undefined }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
}

// A complete single title line (container + centered inner + spans). Used by Template D.
export function TitleLine({
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
  return (
    <div
      style={{
        lineHeight: TITLE_LINE_HEIGHT,
        textAlign: "center",
        fontFamily: TITLE_FONT,
        fontSize: titleSizePx,
        letterSpacing: TITLE_LETTER_SPACING,
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
        <TitleSpans text={text} axes={axes} startOffset={startOffset} />
      </div>
    </div>
  );
}

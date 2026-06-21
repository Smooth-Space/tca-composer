import { axesToCss, type Axes } from "@/lib/engine";
import { TITLE_FONT, TITLE_LETTER_SPACING, TITLE_LINE_HEIGHT } from "@/lib/typo";

// Per-character spans for one line of title text. Shared by TitleBlock (A/B/C)
// and the single-line TitleLine used by Template D.
//
// `animatable` (set only for the live title-animation path) marks each span with
// data-tspan so the rAF DOM-writer can target it, and switches it to inline-block
// with a centered transform-origin so per-letter proportion changes scale from
// each glyph's own horizontal center (the box width is pinned by TitleBlock so
// neighbours don't get shoved). Static rendering keeps plain inline spans.
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
        // Animated whitespace stays normal inline text (white-space: pre so it
        // can't collapse) — an inline-block box would collapse a lone space to
        // zero width and run words together. It still carries data-tspan so the
        // rAF writer's index stays aligned with the flat axes stream.
        //
        // Animated letters are inline-block with a box pinned to their base
        // advance (TitleBlock), so neighbours never move. The glyph is anchored
        // LEFT (text-align:left, overriding the container's inherited center):
        // anchoring its drawing origin to a fixed box edge means a changing
        // advance no longer re-centers the glyph every frame, which previously
        // pixel-snapped into horizontal jitter. It still grows/shrinks in place
        // (overflow visible lets it spill past the pinned box).
        return (
          <span
            key={i}
            data-tspan={animatable ? "" : undefined}
            data-tspace={animatable && isSpace ? "" : undefined}
            style={
              animatable && !isSpace
                ? {
                    display: "inline-block",
                    textAlign: "left",
                    overflow: "visible",
                    fontVariationSettings: a ? axesToCss(a) : undefined,
                  }
                : animatable && isSpace
                  ? {
                      display: "inline",
                      whiteSpace: "pre",
                      fontVariationSettings: spaceA ? axesToCss(spaceA) : undefined,
                    }
                  : {
                      display: "inline",
                      fontVariationSettings: a ? axesToCss(a) : undefined,
                    }
            }
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

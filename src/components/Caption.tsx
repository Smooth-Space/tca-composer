import {
  CAPTION_FONT,
  CAPTION_LINE_HEIGHT,
  CAPTION_SIZE_PX,
  CAPTION_VARIATION,
} from "@/lib/typo";
import type { CaptionKey } from "@/lib/composition";
import { useSelectable } from "@/components/SelectionContext";

// A single caption. Shared by TemplateLayout (B/C), Canvas infoRow (A) and Template D.
export function Caption({
  text,
  color,
  align,
  style,
  captionKey,
  hidden,
}: {
  text: string;
  color: string;
  align: "left" | "right";
  style?: React.CSSProperties;
  captionKey?: CaptionKey;
  hidden?: boolean;
}) {
  const { hideSelection, handleClick, handleDoubleClick, selectableStyle } = useSelectable(
    captionKey ?? null,
  );
  if (hidden && text === "") return null;
  const isEmpty = text === "";
  return (
    <div
      onClick={captionKey ? handleClick : undefined}
      onDoubleClick={captionKey ? handleDoubleClick : undefined}
      style={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        textAlign: align,
        fontFamily: CAPTION_FONT,
        fontVariationSettings: CAPTION_VARIATION,
        fontSize: CAPTION_SIZE_PX,
        lineHeight: CAPTION_LINE_HEIGHT,
        color,
        ...(captionKey ? selectableStyle : null),
        ...style,
      }}
    >
      {isEmpty && captionKey && !hideSelection ? (
        <span style={{ opacity: 0.3 }}>Text</span>
      ) : (
        text
      )}
    </div>
  );
}
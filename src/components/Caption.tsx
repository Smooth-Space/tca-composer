import {
  CAPTION_FONT,
  CAPTION_LINE_HEIGHT,
  CAPTION_SIZE_PX,
  CAPTION_VARIATION,
} from "@/lib/typo";
import type { CaptionKey } from "@/lib/composition";

// A single caption. Shared by TemplateLayout (B/C), Canvas infoRow (A) and Template D.
export function Caption({
  text,
  color,
  align,
  style,
  captionKey,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  text: string;
  color: string;
  align: "left" | "right";
  style?: React.CSSProperties;
  captionKey?: CaptionKey;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  const isSelected = !!captionKey && selectedTitleId === captionKey;
  const isEmpty = text === "";
  return (
    <div
      onClick={
        captionKey && onSelectTitle
          ? (e) => {
              e.stopPropagation();
              onSelectTitle(captionKey);
            }
          : undefined
      }
      style={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        textAlign: align,
        fontFamily: CAPTION_FONT,
        fontVariationSettings: CAPTION_VARIATION,
        fontSize: CAPTION_SIZE_PX,
        lineHeight: CAPTION_LINE_HEIGHT,
        color,
        cursor: captionKey ? "text" : undefined,
        outline: isSelected && !hideSelection ? "2px solid rgba(80,120,255,0.7)" : "none",
        outlineOffset: 4,
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
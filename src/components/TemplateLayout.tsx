import {
  getVisibleRowSlots,
  isRowActive,
  type CaptionSlot,
  type Captions,
  type CaptionColors,
  type CaptionFlags,
  type CaptionAlign,
  type CaptionCounts,
} from "@/lib/composition";
import { Caption } from "@/components/Caption";

function CaptionCell({
  slot,
  captions,
  captionColors,
  captionHidden,
  captionAlign,
}: {
  slot: CaptionSlot;
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  captionAlign: CaptionAlign;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Caption
        text={captions[slot.key]}
        color={captionColors[slot.key]}
        align={captionAlign[slot.key]}
        captionKey={slot.key}
        hidden={captionHidden[slot.key]}
      />
    </div>
  );
}

function CaptionRow({
  slots,
  captions,
  captionColors,
  captionHidden,
  captionAlign,
  captionCounts,
  anchor,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  captionAlign: CaptionAlign;
  captionCounts: CaptionCounts;
  anchor: "top" | "bottom";
}) {
  // A single visible input spans the full width within the margins; two split into halves.
  // Hidden fields are excluded so their sibling spans.
  const rowSlots = getVisibleRowSlots(slots, anchor, captionCounts, captionHidden);
  return (
    <div
      style={{
        display: "flex",
        gap: 40,
        alignItems: "flex-start",
      }}
    >
      {rowSlots.map((slot) => (
        <CaptionCell
          key={slot.key}
          slot={slot}
          captions={captions}
          captionColors={captionColors}
          captionHidden={captionHidden}
          captionAlign={captionAlign}
        />
      ))}
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  captionColors,
  captionHidden,
  captionAlign,
  captionCounts,
  gap = 0,
  children,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  captionAlign: CaptionAlign;
  captionCounts: CaptionCounts;
  gap?: number;
  children: React.ReactNode;
}) {
  // Empty/hidden rows have no physical presence so the title/images fill the space.
  const topActive = isRowActive(slots, captions, captionHidden, captionCounts, "top");
  const bottomActive = isRowActive(slots, captions, captionHidden, captionCounts, "bottom");
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {topActive && (
        <CaptionRow
          slots={slots}
          captions={captions}
          captionColors={captionColors}
          captionHidden={captionHidden}
          captionAlign={captionAlign}
          captionCounts={captionCounts}
          anchor="top"
        />
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      {bottomActive && (
        <CaptionRow
          slots={slots}
          captions={captions}
          captionColors={captionColors}
          captionHidden={captionHidden}
          captionAlign={captionAlign}
          captionCounts={captionCounts}
          anchor="bottom"
        />
      )}
    </div>
  );
}

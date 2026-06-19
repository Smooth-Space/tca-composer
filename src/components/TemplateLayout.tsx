import {
  isCaptionRowActive,
  type CaptionSlot,
  type Captions,
  type CaptionColors,
  type CaptionFlags,
} from "@/lib/composition";
import { Caption } from "@/components/Caption";

function CaptionCell({
  slot,
  captions,
  captionColors,
  captionHidden,
}: {
  slot?: CaptionSlot;
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {slot && (
        <Caption
          text={captions[slot.key]}
          color={captionColors[slot.key]}
          align={slot.align}
          captionKey={slot.key}
          hidden={captionHidden[slot.key]}
        />
      )}
    </div>
  );
}

function CaptionRow({
  slots,
  captions,
  captionColors,
  captionHidden,
  anchor,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  anchor: "top" | "bottom";
}) {
  const rowSlots = slots.filter((s) => s.anchor === anchor);
  const left = rowSlots.find((s) => s.column === "left");
  const right = rowSlots.find((s) => s.column === "right");
  return (
    <div
      style={{
        display: "flex",
        gap: 40,
        alignItems: "flex-start",
      }}
    >
      <CaptionCell
        slot={left}
        captions={captions}
        captionColors={captionColors}
        captionHidden={captionHidden}
      />
      <CaptionCell
        slot={right}
        captions={captions}
        captionColors={captionColors}
        captionHidden={captionHidden}
      />
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  captionColors,
  captionHidden,
  gap = 0,
  collapseEmptyRows = false,
  children,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: CaptionFlags;
  gap?: number;
  collapseEmptyRows?: boolean;
  children: React.ReactNode;
}) {
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
      {(!collapseEmptyRows || isCaptionRowActive(slots, captions, captionHidden, "top")) && (
        <CaptionRow
          slots={slots}
          captions={captions}
          captionColors={captionColors}
          captionHidden={captionHidden}
          anchor="top"
        />
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      {(!collapseEmptyRows || isCaptionRowActive(slots, captions, captionHidden, "bottom")) && (
        <CaptionRow
          slots={slots}
          captions={captions}
          captionColors={captionColors}
          captionHidden={captionHidden}
          anchor="bottom"
        />
      )}
    </div>
  );
}

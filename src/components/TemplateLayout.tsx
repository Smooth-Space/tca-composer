import type { CaptionSlot, CaptionKey } from "@/lib/composition";
import { Caption } from "@/components/Caption";

type Captions = Record<string, string>;
type CaptionColors = Record<CaptionKey, string>;

function CaptionCell({
  slot,
  captions,
  captionColors,
  captionHidden,
}: {
  slot?: CaptionSlot;
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: Record<CaptionKey, boolean>;
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
  captionHidden: Record<CaptionKey, boolean>;
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
        alignItems: anchor === "top" ? "flex-start" : "flex-end",
      }}
    >
      <CaptionCell slot={left} captions={captions} captionColors={captionColors} captionHidden={captionHidden} />
      <CaptionCell slot={right} captions={captions} captionColors={captionColors} captionHidden={captionHidden} />
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  captionColors,
  captionHidden,
  gap = 0,
  children,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  captionHidden: Record<CaptionKey, boolean>;
  gap?: number;
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
      <CaptionRow slots={slots} captions={captions} captionColors={captionColors} captionHidden={captionHidden} anchor="top" />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <CaptionRow slots={slots} captions={captions} captionColors={captionColors} captionHidden={captionHidden} anchor="bottom" />
    </div>
  );
}

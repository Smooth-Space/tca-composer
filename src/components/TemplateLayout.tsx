import type { CaptionSlot, CaptionKey, TextInset } from "@/lib/composition";

type Captions = Record<string, string>;
type CaptionColors = Record<CaptionKey, string>;

function CaptionCell({
  slot,
  captions,
  captionColors,
}: {
  slot?: CaptionSlot;
  captions: Captions;
  captionColors: CaptionColors;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {slot && (
        <div
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            textAlign: slot.align,
            fontFamily: "'ABC Arizona Plus Variable'",
            fontVariationSettings: `"wght" 400, "SRFF" 0, "wdth" 100`,
            fontSize: 36,
            lineHeight: 1.1,
            color: captionColors[slot.key],
          }}
        >
          {captions[slot.key]}
        </div>
      )}
    </div>
  );
}

function CaptionRow({
  slots,
  captions,
  captionColors,
  anchor,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
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
      <CaptionCell slot={left} captions={captions} captionColors={captionColors} />
      <CaptionCell slot={right} captions={captions} captionColors={captionColors} />
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  captionColors,
  gap = 0,
  inset = { top: 40, bottom: 40, left: 40, right: 40 },
  children,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  gap?: number;
  inset?: TextInset;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        paddingTop: inset.top,
        paddingBottom: inset.bottom,
        paddingLeft: inset.left,
        paddingRight: inset.right,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      <CaptionRow slots={slots} captions={captions} captionColors={captionColors} anchor="top" />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <CaptionRow slots={slots} captions={captions} captionColors={captionColors} anchor="bottom" />
    </div>
  );
}
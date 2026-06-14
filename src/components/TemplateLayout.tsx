import type { CaptionSlot } from "@/lib/composition";

type Captions = Record<string, string>;

function CaptionCell({
  slot,
  captions,
  color,
}: {
  slot?: CaptionSlot;
  captions: Captions;
  color: string;
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
            color,
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
  color,
  anchor,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  color: string;
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
      <CaptionCell slot={left} captions={captions} color={color} />
      <CaptionCell slot={right} captions={captions} color={color} />
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  textColor,
  children,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  textColor: string;
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
      }}
    >
      <CaptionRow slots={slots} captions={captions} color={textColor} anchor="top" />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <CaptionRow slots={slots} captions={captions} color={textColor} anchor="bottom" />
    </div>
  );
}
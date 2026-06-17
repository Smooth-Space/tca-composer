import type { CaptionSlot, CaptionKey } from "@/lib/composition";
import { Caption } from "@/components/Caption";

type Captions = Record<string, string>;
type CaptionColors = Record<CaptionKey, string>;

function CaptionCell({
  slot,
  captions,
  captionColors,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  slot?: CaptionSlot;
  captions: Captions;
  captionColors: CaptionColors;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {slot && (
        <Caption
          text={captions[slot.key]}
          color={captionColors[slot.key]}
          align={slot.align}
          captionKey={slot.key}
          selectedTitleId={selectedTitleId}
          onSelectTitle={onSelectTitle}
          hideSelection={hideSelection}
        />
      )}
    </div>
  );
}

function CaptionRow({
  slots,
  captions,
  captionColors,
  anchor,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  anchor: "top" | "bottom";
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
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
      <CaptionCell
        slot={left}
        captions={captions}
        captionColors={captionColors}
        selectedTitleId={selectedTitleId}
        onSelectTitle={onSelectTitle}
        hideSelection={hideSelection}
      />
      <CaptionCell
        slot={right}
        captions={captions}
        captionColors={captionColors}
        selectedTitleId={selectedTitleId}
        onSelectTitle={onSelectTitle}
        hideSelection={hideSelection}
      />
    </div>
  );
}

export function TemplateLayout({
  slots,
  captions,
  captionColors,
  gap = 0,
  children,
  selectedTitleId,
  onSelectTitle,
  hideSelection,
}: {
  slots: CaptionSlot[];
  captions: Captions;
  captionColors: CaptionColors;
  gap?: number;
  children: React.ReactNode;
  selectedTitleId?: string | null;
  onSelectTitle?: (id: string | null) => void;
  hideSelection?: boolean;
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
      <CaptionRow
        slots={slots}
        captions={captions}
        captionColors={captionColors}
        anchor="top"
        selectedTitleId={selectedTitleId}
        onSelectTitle={onSelectTitle}
        hideSelection={hideSelection}
      />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
      <CaptionRow
        slots={slots}
        captions={captions}
        captionColors={captionColors}
        anchor="bottom"
        selectedTitleId={selectedTitleId}
        onSelectTitle={onSelectTitle}
        hideSelection={hideSelection}
      />
    </div>
  );
}
import { createContext, useContext, useMemo } from "react";

export interface SelectionValue {
  selectedTitleId: string | null;
  onSelectTitle: (id: string | null) => void;
  onRequestEdit: (id: string, mode: "end" | "all") => void;
  hideSelection: boolean;
}

const SelectionContext = createContext<SelectionValue>({
  selectedTitleId: null,
  onSelectTitle: () => {},
  onRequestEdit: () => {},
  hideSelection: false,
});

export function SelectionProvider({
  selectedTitleId,
  onSelectTitle,
  onRequestEdit,
  hideSelection,
  children,
}: SelectionValue & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ selectedTitleId, onSelectTitle, onRequestEdit, hideSelection }),
    [selectedTitleId, onSelectTitle, onRequestEdit, hideSelection],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  return useContext(SelectionContext);
}

// Selection wiring for one selectable element (title id or caption key).
// Returns the click handler + outline style + flags; the empty-placeholder text
// stays in each consumer (it differs: "Title" vs "Text", and color).
export function useSelectable(id: string | null) {
  const { selectedTitleId, onRequestEdit, hideSelection } = useSelection();
  const selected = !!id && selectedTitleId === id;
  return {
    selected,
    hideSelection,
    handleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (id) onRequestEdit(id, "end");
    },
    handleDoubleClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (id) onRequestEdit(id, "all");
    },
    // Deliberately no selection outline. The artboard is a preview of the
    // exported artwork, so nothing should sit on top of it that will not be in
    // the export — the 2px blue ring that used to live here was off-palette and
    // framed the composition at exactly the moment you were trying to judge it.
    //
    // Selection stays legible without it: clicking an element focuses its field
    // in the control panel, and cursor:text marks the element as editable. If a
    // canvas indicator is ever wanted again, it belongs in the TCA palette and
    // must stay gated on hideSelection so it cannot reach an export.
    selectableStyle: {
      cursor: "text",
    } as React.CSSProperties,
  };
}

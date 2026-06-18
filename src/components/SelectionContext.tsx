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
    selectableStyle: {
      cursor: "text",
      outline: selected && !hideSelection ? "2px solid rgba(80,120,255,0.7)" : "none",
      outlineOffset: 4,
    } as React.CSSProperties,
  };
}

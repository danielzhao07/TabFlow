import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import React from 'react';

export type DropTarget =
  | { type: 'group'; groupId: number }
  | { type: 'window'; windowId: number }
  | { type: 'workspace'; workspaceId: string }
  | { type: 'suggestion'; label: string; tabIds: number[] }
  | { type: 'tab'; index: number };

export interface DragState {
  /** The single tab being dragged (always set during drag) */
  dragTabId: number | null;
  /** All tab IDs being dragged (multi-select) */
  dragTabIds: number[];
  /** Current drop target the cursor is over */
  dropTarget: DropTarget | null;
}

export interface DragContextValue extends DragState {
  startDrag: (tabId: number, allSelectedIds: number[]) => void;
  endDrag: () => void;
  setDropTarget: (target: DropTarget | null) => void;
}

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: ReactNode }) {
  const [dragTabId, setDragTabId] = useState<number | null>(null);
  const [dragTabIds, setDragTabIds] = useState<number[]>([]);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const startDrag = useCallback((tabId: number, allSelectedIds: number[]) => {
    setDragTabId(tabId);
    setDragTabIds(allSelectedIds.length > 0 ? allSelectedIds : [tabId]);
  }, []);

  const endDrag = useCallback(() => {
    setDragTabId(null);
    setDragTabIds([]);
    setDropTarget(null);
  }, []);

  return React.createElement(
    DragContext.Provider,
    {
      value: { dragTabId, dragTabIds, dropTarget, startDrag, endDrag, setDropTarget },
    },
    children,
  );
}

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDragContext must be used within DragProvider');
  return ctx;
}

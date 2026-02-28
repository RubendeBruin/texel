import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Cell } from './Cell';
import { ColResizeHandle, RowResizeHandle } from './ResizeHandle';

interface GridProps {
  numRows: number;
  numCols: number;
  getCell: (row: number, col: number) => { content: string } | undefined;
  setCell: (row: number, col: number, content: string) => void;
  moveCell: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  getRowHeight: (row: number) => number;
  getColWidth: (col: number) => number;
  setRowHeight: (row: number, height: number) => void;
  setColWidth: (col: number, width: number) => void;
}

const ROW_HEADER_W = 52;
const COL_HEADER_H = 28;

function colLabel(col: number): string {
  let label = '';
  let n = col;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export const Grid: React.FC<GridProps> = ({
  numRows,
  numCols,
  getCell,
  setCell,
  moveCell,
  getRowHeight,
  getColWidth,
  setRowHeight,
  setColWidth,
}) => {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [draggingCell, setDraggingCell] = useState<{ row: number; col: number } | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll the selected cell into view whenever selection changes
  useEffect(() => {
    if (!selected || !scrollRef.current) return;
    const td = scrollRef.current.querySelector<HTMLElement>(
      `[data-cellkey="${selected.row}-${selected.col}"]`
    );
    td?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const returnFocusToGrid = useCallback(() => {
    scrollRef.current?.focus();
  }, []);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Let the textarea handle its own keys while editing
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab'];
      if (!NAV_KEYS.includes(e.key)) return;

      e.preventDefault();

      if (e.key === 'Escape') {
        setSelected(null);
        return;
      }

      // If nothing is selected yet, start at top-left
      const row = selected?.row ?? 0;
      const col = selected?.col ?? 0;

      if (e.key === 'Enter') {
        setSelected({ row, col });
        setPendingEdit(true);
        return;
      }

      let newRow = row;
      let newCol = col;
      if (e.key === 'ArrowUp') newRow = Math.max(0, row - 1);
      else if (e.key === 'ArrowDown') newRow = Math.min(numRows - 1, row + 1);
      else if (e.key === 'ArrowLeft') newCol = Math.max(0, col - 1);
      else if (e.key === 'ArrowRight' || e.key === 'Tab') newCol = Math.min(numCols - 1, col + 1);

      setSelected({ row: newRow, col: newCol });
    },
    [selected, numRows, numCols]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleSelect = useCallback((row: number, col: number) => {
    setSelected({ row, col });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { row, col } = event.active.data.current as { row: number; col: number };
    setDraggingCell({ row, col });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingCell(null);
      const over = event.over;
      if (!over) return;
      const { row: fromRow, col: fromCol } = event.active.data.current as { row: number; col: number };
      const { row: toRow, col: toCol } = over.data.current as { row: number; col: number };
      if (fromRow === toRow && fromCol === toCol) return;
      moveCell(fromRow, fromCol, toRow, toCol);
    },
    [moveCell]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges]}
    >
      {/* Outer scroll container — needed for sticky to work */}
      <div
        ref={scrollRef}
        tabIndex={0}
        style={{ flex: 1, overflow: 'auto', position: 'relative', outline: 'none' }}
        onClick={() => setSelected(null)}
        onKeyDown={handleGridKeyDown}
      >
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {/* top-left corner */}
              <th
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 30,
                  width: ROW_HEADER_W,
                  minWidth: ROW_HEADER_W,
                  height: COL_HEADER_H,
                  background: 'var(--surface)',
                  borderRight: '1px solid var(--border)',
                  borderBottom: '2px solid var(--border)',
                  padding: 0,
                }}
              />
              {/* Column headers */}
              {Array.from({ length: numCols }, (_, c) => {
                const w = getColWidth(c);
                return (
                  <th
                    key={c}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      height: COL_HEADER_H,
                      background: 'var(--surface)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '2px solid var(--border)',
                      fontSize: 11,
                      color: selected?.col === c ? 'var(--accent)' : 'var(--text-dim)',
                      fontWeight: 600,
                      letterSpacing: 1,
                      textAlign: 'center',
                      userSelect: 'none',
                      padding: 0,
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      {colLabel(c)}
                      <ColResizeHandle col={c} currentWidth={w} onResize={setColWidth} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }, (_, r) => {
              const h = getRowHeight(r);
              return (
                <tr key={r}>
                  {/* Row header — sticky left */}
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      width: ROW_HEADER_W,
                      minWidth: ROW_HEADER_W,
                      height: h,
                      background: 'var(--surface)',
                      borderRight: '1px solid var(--border)',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 11,
                      color: selected?.row === r ? 'var(--accent)' : 'var(--text-dim)',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      userSelect: 'none',
                      padding: 0,
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      {r + 1}
                      <RowResizeHandle row={r} currentHeight={h} onResize={setRowHeight} />
                    </div>
                  </td>

                  {/* Data cells */}
                  {Array.from({ length: numCols }, (_, c) => {
                    const w = getColWidth(c);
                    const cell = getCell(r, c);
                    const isThisSelected = selected?.row === r && selected?.col === c;
                    return (
                      <td
                        key={c}
                        data-cellkey={`${r}-${c}`}
                        style={{
                          padding: 0,
                          width: w,
                          minWidth: w,
                          maxWidth: w,
                          height: h,
                          verticalAlign: 'top',
                          overflow: 'hidden',
                        }}
                      >
                        <Cell
                          row={r}
                          col={c}
                          width={w}
                          height={h}
                          content={cell?.content ?? ''}
                          isSelected={isThisSelected}
                          onSelect={handleSelect}
                          onContentChange={setCell}
                          onResizeRow={setRowHeight}
                          onResizeCol={setColWidth}
                          autoEdit={isThisSelected && pendingEdit}
                          onAutoEditHandled={() => setPendingEdit(false)}
                          onEditEnd={returnFocusToGrid}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {draggingCell && (() => {
          const cell = getCell(draggingCell.row, draggingCell.col);
          return (
            <div
              style={{
                width: getColWidth(draggingCell.col),
                height: getRowHeight(draggingCell.row),
                background: 'var(--cell-bg-selected)',
                border: '2px solid var(--accent)',
                borderRadius: 4,
                padding: 8,
                fontSize: 12,
                color: 'var(--text)',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                opacity: 0.9,
                pointerEvents: 'none',
              }}
            >
              <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
                {cell?.content ?? ''}
              </pre>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
};

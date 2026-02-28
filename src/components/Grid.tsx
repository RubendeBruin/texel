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
  getCell: (row: number, col: number) => { content: string; color?: string } | undefined;
  setCell: (row: number, col: number, content: string) => void;
  moveCell: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  getRowHeight: (row: number) => number;
  getColWidth: (col: number) => number;
  setRowHeight: (row: number, height: number) => void;
  setColWidth: (col: number, width: number) => void;
  setCellColors: (positions: { row: number; col: number }[], color: string | undefined) => void;
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

// ── selection helpers ──────────────────────────────────────────────────────────

type Pos = { row: number; col: number };

function getRect(a: Pos | null, b: Pos | null) {
  if (!a) return null;
  const e = b ?? a;
  return {
    minRow: Math.min(a.row, e.row),
    maxRow: Math.max(a.row, e.row),
    minCol: Math.min(a.col, e.col),
    maxCol: Math.max(a.col, e.col),
  };
}

function inRect(rect: ReturnType<typeof getRect>, r: number, c: number): boolean {
  if (!rect) return false;
  return r >= rect.minRow && r <= rect.maxRow && c >= rect.minCol && c <= rect.maxCol;
}

// ──────────────────────────────────────────────────────────────────────────────

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
  setCellColors,
}) => {
  // Selection: anchor = primary cell; selectionEnd extends a range (shift+click / shift+arrow)
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Pos | null>(null);
  const [draggingCell, setDraggingCell] = useState<Pos | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [fillColor, setFillColor] = useState('#ffd700');
  const scrollRef = useRef<HTMLDivElement>(null);

  const selRect = getRect(anchor, selectionEnd);

  // Scroll anchor cell into view when selection moves
  useEffect(() => {
    if (!anchor || !scrollRef.current) return;
    scrollRef.current
      .querySelector<HTMLElement>(`[data-cellkey="${anchor.row}-${anchor.col}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [anchor]);

  const returnFocusToGrid = useCallback(() => {
    scrollRef.current?.focus();
  }, []);

  // ── fill operations ──────────────────────────────────────────────────────────

  const handleApplyFill = useCallback(() => {
    if (!selRect) return;
    const positions: Pos[] = [];
    for (let r = selRect.minRow; r <= selRect.maxRow; r++)
      for (let c = selRect.minCol; c <= selRect.maxCol; c++)
        positions.push({ row: r, col: c });
    setCellColors(positions, fillColor);
  }, [selRect, fillColor, setCellColors]);

  const handleClearFill = useCallback(() => {
    if (!selRect) return;
    const positions: Pos[] = [];
    for (let r = selRect.minRow; r <= selRect.maxRow; r++)
      for (let c = selRect.minCol; c <= selRect.maxCol; c++)
        positions.push({ row: r, col: c });
    setCellColors(positions, undefined);
  }, [selRect, setCellColors]);

  const selCount = selRect
    ? (selRect.maxRow - selRect.minRow + 1) * (selRect.maxCol - selRect.minCol + 1)
    : 0;

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const NAV_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab'];
      if (!NAV_KEYS.includes(e.key)) return;

      e.preventDefault();

      if (e.key === 'Escape') {
        setAnchor(null);
        setSelectionEnd(null);
        return;
      }

      const row = anchor?.row ?? 0;
      const col = anchor?.col ?? 0;

      if (e.key === 'Enter') {
        setAnchor({ row, col });
        setSelectionEnd({ row, col });
        setPendingEdit(true);
        return;
      }

      if (e.shiftKey && anchor) {
        // Extend the selection range without moving the anchor
        const curEnd = selectionEnd ?? anchor;
        let endRow = curEnd.row;
        let endCol = curEnd.col;
        if (e.key === 'ArrowUp') endRow = Math.max(0, endRow - 1);
        else if (e.key === 'ArrowDown') endRow = Math.min(numRows - 1, endRow + 1);
        else if (e.key === 'ArrowLeft') endCol = Math.max(0, endCol - 1);
        else if (e.key === 'ArrowRight' || e.key === 'Tab') endCol = Math.min(numCols - 1, endCol + 1);
        setSelectionEnd({ row: endRow, col: endCol });
      } else {
        let newRow = row;
        let newCol = col;
        if (e.key === 'ArrowUp') newRow = Math.max(0, row - 1);
        else if (e.key === 'ArrowDown') newRow = Math.min(numRows - 1, row + 1);
        else if (e.key === 'ArrowLeft') newCol = Math.max(0, col - 1);
        else if (e.key === 'ArrowRight' || e.key === 'Tab') newCol = Math.min(numCols - 1, col + 1);
        setAnchor({ row: newRow, col: newCol });
        setSelectionEnd({ row: newRow, col: newCol });
      }
    },
    [anchor, selectionEnd, numRows, numCols]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleSelect = useCallback((row: number, col: number, extend?: boolean) => {
    if (extend && anchor) {
      setSelectionEnd({ row, col });
    } else {
      setAnchor({ row, col });
      setSelectionEnd({ row, col });
    }
  }, [anchor]);
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Fill colour toolbar — shown when one or more cells are selected */}
      {anchor && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-dim)', userSelect: 'none' }}>Fill:</span>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={{
              width: 32,
              height: 24,
              padding: 0,
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              background: 'none',
            }}
            title="Choose fill colour"
          />
          <button
            onClick={handleApplyFill}
            style={{
              fontSize: 12,
              padding: '2px 10px',
              background: fillColor,
              color: '#111',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Apply
          </button>
          <button
            onClick={handleClearFill}
            style={{
              fontSize: 12,
              padding: '2px 10px',
              background: 'var(--surface2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4, userSelect: 'none' }}>
            {selCount} cell{selCount !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        {/* Scroll container — needed for sticky headers to work */}
        <div
          ref={scrollRef}
          tabIndex={0}
          style={{ flex: 1, overflow: 'auto', position: 'relative', outline: 'none' }}
          onClick={() => { setAnchor(null); setSelectionEnd(null); }}
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
                  const colHighlighted = selRect ? c >= selRect.minCol && c <= selRect.maxCol : false;
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
                        color: colHighlighted ? 'var(--accent)' : 'var(--text-dim)',
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
                const rowHighlighted = selRect ? r >= selRect.minRow && r <= selRect.maxRow : false;
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
                        color: rowHighlighted ? 'var(--accent)' : 'var(--text-dim)',
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
                      const isThisSelected = inRect(selRect, r, c);
                      const isAnchor = anchor?.row === r && anchor?.col === c;
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
                            cellColor={cell?.color}
                            isSelected={isThisSelected}
                            onSelect={handleSelect}
                            onContentChange={setCell}
                            onResizeRow={setRowHeight}
                            onResizeCol={setColWidth}
                            autoEdit={isAnchor && pendingEdit}
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
    </div>
  );
};

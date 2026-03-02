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
  insertRow: (at: number) => void;
  deleteRow: (at: number) => void;
  insertCol: (at: number) => void;
  deleteCol: (at: number) => void;
  expandGrid: (minRows: number, minCols: number) => void;
  onSelectionChange: (positions: { row: number; col: number }[]) => void;
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

// ── clipboard helpers ───────────────────────────────────────────────────────────

/** Escape one cell value for TSV: quote if it contains tab, newline, or double-quote. */
function tsvEscapeCell(text: string): string {
  if (text.includes('\t') || text.includes('\n') || text.includes('\r') || text.includes('"')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

/**
 * Parse a TSV/clipboard string (Excel-compatible, supports quoted fields).
 * Returns a 2-D array [row][col] of plain strings.
 */
function parseTSV(raw: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = raw.length;

  while (i <= n) {
    if (i === n || raw[i] === '\n' || raw[i] === '\r') {
      result.push(row);
      row = [];
      if (i < n && raw[i] === '\r' && raw[i + 1] === '\n') i++; // CRLF
      i++;
    } else if (raw[i] === '\t') {
      row.push('');
      i++;
    } else if (raw[i] === '"') {
      // Quoted field
      i++;
      let field = '';
      while (i < n) {
        if (raw[i] === '"' && raw[i + 1] === '"') { field += '"'; i += 2; }
        else if (raw[i] === '"') { i++; break; }
        else { field += raw[i++]; }
      }
      row.push(field);
      // skip trailing tab
      if (i < n && raw[i] === '\t') i++;
    } else {
      // Unquoted field
      const tabIdx = raw.indexOf('\t', i);
      const nlIdx  = raw.indexOf('\n', i);
      const crIdx  = raw.indexOf('\r', i);
      const candidates = [tabIdx, nlIdx, crIdx].filter((x) => x !== -1);
      const end = candidates.length ? Math.min(...candidates) : n;
      row.push(raw.slice(i, end));
      i = end;
      if (i < n && raw[i] === '\t') i++; // consume tab separator
    }
  }

  // Drop trailing empty row that parsers often produce
  if (result.length > 0 && result[result.length - 1].join('') === '') result.pop();

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────

function ctxItemStyle(danger: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '7px 16px',
    cursor: 'pointer',
    fontSize: 13,
    color: danger ? '#f25c5c' : 'var(--text)',
    borderRadius: 0,
  };
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
  setCellColors,
  insertRow,
  deleteRow,
  insertCol,
  deleteCol,
  expandGrid,
  onSelectionChange,
}) => {
  // Selection: anchor = primary cell; selectionEnd extends a range (shift+click / shift+arrow)
  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Pos | null>(null);
  const [draggingCell, setDraggingCell] = useState<Pos | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── context menu ────────────────────────────────────────────────────────────
  type CtxMenu =
    | { kind: 'row'; index: number; x: number; y: number }
    | { kind: 'col'; index: number; x: number; y: number };
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const openRowMenu = useCallback((e: React.MouseEvent, row: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ kind: 'row', index: row, x: e.clientX, y: e.clientY });
  }, []);

  const openColMenu = useCallback((e: React.MouseEvent, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ kind: 'col', index: col, x: e.clientX, y: e.clientY });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const selRect = getRect(anchor, selectionEnd);

  // Dismiss context menu when clicking elsewhere
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ctxMenu]);

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

  // Bubble selection changes up to parent
  useEffect(() => {
    const rect = getRect(anchor, selectionEnd);
    const positions: { row: number; col: number }[] = [];
    if (rect) {
      for (let r = rect.minRow; r <= rect.maxRow; r++)
        for (let c = rect.minCol; c <= rect.maxCol; c++)
          positions.push({ row: r, col: c });
    }
    onSelectionChange(positions);
  }, [anchor, selectionEnd, onSelectionChange]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

      // ── copy / cut / paste ───────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
        if (!selRect) return;
        const tsvRows: string[] = [];
        for (let r = selRect.minRow; r <= selRect.maxRow; r++) {
          const cols: string[] = [];
          for (let c = selRect.minCol; c <= selRect.maxCol; c++) {
            cols.push(tsvEscapeCell(getCell(r, c)?.content ?? ''));
          }
          tsvRows.push(cols.join('\t'));
        }
        navigator.clipboard.writeText(tsvRows.join('\r\n')).catch(() => {});
        if (e.key === 'x') {
          // Cut: clear content of selected cells
          for (let r = selRect.minRow; r <= selRect.maxRow; r++)
            for (let c = selRect.minCol; c <= selRect.maxCol; c++)
              setCell(r, c, '');
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!anchor) return;
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const rows = parseTSV(text);
          for (let ri = 0; ri < rows.length; ri++)
            for (let ci = 0; ci < rows[ri].length; ci++)
              setCell(anchor.row + ri, anchor.col + ci, rows[ri][ci]);
        }).catch(() => {});
        return;
      }

      // Ctrl+B — toggle bold on all selected cells (grid-level, not editing)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        if (!selRect) return;
        e.preventDefault();
        for (let r = selRect.minRow; r <= selRect.maxRow; r++) {
          for (let c = selRect.minCol; c <= selRect.maxCol; c++) {
            const current = getCell(r, c)?.content ?? '';
            const isBold = current.startsWith('**') && current.endsWith('**') && current.length >= 4;
            setCell(r, c, isBold ? current.slice(2, -2) : `**${current}**`);
          }
        }
        return;
      }

      // ── navigation ───────────────────────────────────────────────
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
        else if (e.key === 'ArrowDown') endRow = endRow + 1;
        else if (e.key === 'ArrowLeft') endCol = Math.max(0, endCol - 1);
        else if (e.key === 'ArrowRight' || e.key === 'Tab') endCol = endCol + 1;
        expandGrid(endRow + 5, endCol + 3);
        setSelectionEnd({ row: endRow, col: endCol });
      } else {
        let newRow = row;
        let newCol = col;
        if (e.key === 'ArrowUp') newRow = Math.max(0, row - 1);
        else if (e.key === 'ArrowDown') newRow = row + 1;
        else if (e.key === 'ArrowLeft') newCol = Math.max(0, col - 1);
        else if (e.key === 'ArrowRight' || e.key === 'Tab') newCol = col + 1;
        expandGrid(newRow + 5, newCol + 3);
        setAnchor({ row: newRow, col: newCol });
        setSelectionEnd({ row: newRow, col: newCol });
      }
    },
    [anchor, selectionEnd, selRect, numRows, numCols, getCell, setCell, expandGrid]
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
                      onContextMenu={(e) => openColMenu(e, c)}
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
                      onContextMenu={(e) => openRowMenu(e, r)}
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

      {/* Context menu — fixed-positioned so it floats above everything */}
      {ctxMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            minWidth: 190,
            padding: '4px 0',
            fontSize: 13,
          }}
        >
          {ctxMenu.kind === 'row' ? (
            <>
              <div style={{ padding: '3px 12px 6px', fontSize: 11, color: 'var(--text-dim)', userSelect: 'none', borderBottom: '1px solid var(--border)' }}>
                Row {ctxMenu.index + 1}
              </div>
              {([
                { label: 'Insert row above', action: () => { insertRow(ctxMenu.index); closeCtxMenu(); } },
                { label: 'Insert row below', action: () => { insertRow(ctxMenu.index + 1); closeCtxMenu(); } },
                { label: 'Delete row', action: () => { deleteRow(ctxMenu.index); closeCtxMenu(); }, danger: true },
              ] as { label: string; action: () => void; danger?: boolean }[]).map(({ label, action, danger }) => (
                <button key={label} onClick={action} className="ctx-menu-item" style={ctxItemStyle(!!danger)}>{label}</button>
              ))}
            </>
          ) : (
            <>
              <div style={{ padding: '3px 12px 6px', fontSize: 11, color: 'var(--text-dim)', userSelect: 'none', borderBottom: '1px solid var(--border)' }}>
                Column {colLabel(ctxMenu.index)}
              </div>
              {([
                { label: 'Insert column left',  action: () => { insertCol(ctxMenu.index); closeCtxMenu(); } },
                { label: 'Insert column right', action: () => { insertCol(ctxMenu.index + 1); closeCtxMenu(); } },
                { label: 'Delete column', action: () => { deleteCol(ctxMenu.index); closeCtxMenu(); }, danger: true },
              ] as { label: string; action: () => void; danger?: boolean }[]).map(({ label, action, danger }) => (
                <button key={label} onClick={action} className="ctx-menu-item" style={ctxItemStyle(!!danger)}>{label}</button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

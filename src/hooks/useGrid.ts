import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  GridState,
  CellData,
  cellKey,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  INITIAL_ROWS,
  INITIAL_COLS,
} from '../types';

function createInitialGrid(): GridState {
  return {
    cells: {},
    rowHeights: {},
    colWidths: {},
    numRows: INITIAL_ROWS,
    numCols: INITIAL_COLS,
  };
}

export function useGrid() {
  const [grid, setGrid] = useState<GridState>(createInitialGrid);

  const getCell = useCallback(
    (row: number, col: number): CellData | undefined => {
      return grid.cells[cellKey(row, col)];
    },
    [grid.cells]
  );

  const setCell = useCallback((row: number, col: number, content: string) => {
    setGrid((prev) => {
      const key = cellKey(row, col);
      const existingCell = prev.cells[key];
      const updatedCells = { ...prev.cells };
      if (content === '' && existingCell) {
        // Keep the cell entry if it still has a background colour
        if (existingCell.color) {
          updatedCells[key] = { ...existingCell, content: '' };
        } else {
          delete updatedCells[key];
        }
      } else if (content !== '') {
        updatedCells[key] = existingCell
          ? { ...existingCell, content }
          : { id: uuidv4(), row, col, content };
      }
      // Expand grid if needed
      const numRows = Math.max(prev.numRows, row + 5);
      const numCols = Math.max(prev.numCols, col + 3);
      return { ...prev, cells: updatedCells, numRows, numCols };
    });
  }, []);

  const moveCell = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setGrid((prev) => {
      const fromKey = cellKey(fromRow, fromCol);
      const toKey = cellKey(toRow, toCol);
      const fromCell = prev.cells[fromKey];
      if (!fromCell) return prev;

      const updatedCells = { ...prev.cells };
      delete updatedCells[fromKey];
      // Move to target (overwrite if exists)
      updatedCells[toKey] = { ...fromCell, id: uuidv4(), row: toRow, col: toCol };
      const numRows = Math.max(prev.numRows, toRow + 5);
      const numCols = Math.max(prev.numCols, toCol + 3);
      return { ...prev, cells: updatedCells, numRows, numCols };
    });
  }, []);

  const swapCells = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    setGrid((prev) => {
      const k1 = cellKey(r1, c1);
      const k2 = cellKey(r2, c2);
      const cell1 = prev.cells[k1];
      const cell2 = prev.cells[k2];
      const updatedCells = { ...prev.cells };
      if (cell1) updatedCells[k2] = { ...cell1, id: uuidv4(), row: r2, col: c2 };
      else delete updatedCells[k2];
      if (cell2) updatedCells[k1] = { ...cell2, id: uuidv4(), row: r1, col: c1 };
      else delete updatedCells[k1];
      return { ...prev, cells: updatedCells };
    });
  }, []);

  const setRowHeight = useCallback((row: number, height: number) => {
    setGrid((prev) => ({
      ...prev,
      rowHeights: { ...prev.rowHeights, [row]: Math.max(40, height) },
    }));
  }, []);

  const setColWidth = useCallback((col: number, width: number) => {
    setGrid((prev) => ({
      ...prev,
      colWidths: { ...prev.colWidths, [col]: Math.max(80, width) },
    }));
  }, []);

  const getRowHeight = useCallback(
    (row: number) => grid.rowHeights[row] ?? DEFAULT_ROW_HEIGHT,
    [grid.rowHeights]
  );

  const getColWidth = useCallback(
    (col: number) => grid.colWidths[col] ?? DEFAULT_COL_WIDTH,
    [grid.colWidths]
  );

  const setAllColWidths = useCallback((widths: Record<number, number>) => {
    setGrid((prev) => ({ ...prev, colWidths: { ...prev.colWidths, ...widths } }));
  }, []);

  const setAllRowHeights = useCallback((heights: Record<number, number>) => {
    setGrid((prev) => ({ ...prev, rowHeights: { ...prev.rowHeights, ...heights } }));
  }, []);

  const setCellColors = useCallback(
    (positions: { row: number; col: number }[], color: string | undefined) => {
      setGrid((prev) => {
        const updatedCells = { ...prev.cells };
        for (const { row, col } of positions) {
          const key = cellKey(row, col);
          const existing = updatedCells[key];
          if (color === undefined) {
            // Remove colour; delete cell entirely if it also has no content
            if (existing) {
              if (existing.content) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { color: _c, ...rest } = existing;
                updatedCells[key] = rest as CellData;
              } else {
                delete updatedCells[key];
              }
            }
          } else {
            updatedCells[key] = existing
              ? { ...existing, color }
              : { id: uuidv4(), row, col, content: '', color };
          }
        }
        return { ...prev, cells: updatedCells };
      });
    },
    []
  );

  const loadGrid = useCallback((newGrid: GridState) => {
    setGrid(newGrid);
  }, []);

  const clearGrid = useCallback(() => {
    setGrid(createInitialGrid());
  }, []);

  return {
    grid,
    getCell,
    setCell,
    moveCell,
    swapCells,
    setRowHeight,
    setColWidth,
    setAllColWidths,
    setAllRowHeights,
    getRowHeight,
    getColWidth,
    setCellColors,
    loadGrid,
    clearGrid,
  };
}

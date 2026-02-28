// Core types for Texel

export interface CellData {
  id: string;
  row: number;
  col: number;
  content: string; // markdown text
}

export interface GridState {
  cells: Record<string, CellData>; // key: "row-col"
  rowHeights: Record<number, number>;   // row index -> height in px
  colWidths: Record<number, number>;    // col index -> width in px
  numRows: number;
  numCols: number;
}

export interface TexelFile {
  version: number;
  grid: GridState;
  metadata: {
    title: string;
    createdAt: string;
    updatedAt: string;
  };
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export const DEFAULT_COL_WIDTH = 200;
export const DEFAULT_ROW_HEIGHT = 120;
export const INITIAL_ROWS = 20;
export const INITIAL_COLS = 10;

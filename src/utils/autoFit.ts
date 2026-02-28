import { GridState, cellKey, DEFAULT_COL_WIDTH } from '../types';

const CELL_FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const H_PADDING = 28; // matches cell padding (8px each side) + drag handle clearance
const V_PADDING = 20; // top + bottom cell padding
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 600;
const MIN_ROW_HEIGHT = 40;
const MAX_ROW_HEIGHT = 800;

/** Strip common Markdown syntax before measuring plain-text width */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^[-*+]\s+/, '  ')
    .replace(/^\d+\.\s+/, '   ');
}

/**
 * Compute auto-fit column widths based on the longest line of text in each column.
 * Uses a hidden <span> to measure rendered text width.
 */
export function computeAutoColWidths(grid: GridState): Record<number, number> {
  const span = document.createElement('span');
  span.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    'white-space:pre',
    `font:${CELL_FONT}`,
    'top:-9999px',
    'left:-9999px',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(span);

  const result: Record<number, number> = {};

  for (let c = 0; c < grid.numCols; c++) {
    let maxWidth = MIN_COL_WIDTH;

    for (let r = 0; r < grid.numRows; r++) {
      const cell = grid.cells[cellKey(r, c)];
      if (!cell?.content) continue;

      for (const line of cell.content.split('\n')) {
        span.textContent = stripMarkdown(line);
        const w = span.offsetWidth + H_PADDING;
        if (w > maxWidth) maxWidth = w;
      }
    }

    result[c] = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, maxWidth));
  }

  document.body.removeChild(span);
  return result;
}

/**
 * Compute auto-fit row heights by measuring how tall each cell's text is
 * when wrapped to the (possibly freshly computed) column width.
 */
export function computeAutoRowHeights(
  grid: GridState,
  colWidths: Record<number, number>
): Record<number, number> {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:absolute',
    'visibility:hidden',
    `font:${CELL_FONT}`,
    'word-break:break-word',
    'white-space:pre-wrap',
    'line-height:1.5',
    'top:-9999px',
    'left:-9999px',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(div);

  const result: Record<number, number> = {};

  for (let r = 0; r < grid.numRows; r++) {
    let maxHeight = MIN_ROW_HEIGHT;

    for (let c = 0; c < grid.numCols; c++) {
      const cell = grid.cells[cellKey(r, c)];
      if (!cell?.content) continue;

      const colW = colWidths[c] ?? DEFAULT_COL_WIDTH;
      div.style.width = `${colW - H_PADDING}px`;
      div.textContent = cell.content;

      const h = div.scrollHeight + V_PADDING;
      if (h > maxHeight) maxHeight = h;
    }

    result[r] = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, maxHeight));
  }

  document.body.removeChild(div);
  return result;
}

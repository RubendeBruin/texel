import { GridState, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, cellKey } from '../types';
import { saveFile } from './fileIO';

/** Collect only the populated extent of the grid */
function getPopulatedBounds(grid: GridState) {
  const keys = Object.keys(grid.cells);
  if (keys.length === 0) return { maxRow: 5, maxCol: 5 };
  let maxRow = 0;
  let maxCol = 0;
  keys.forEach((k) => {
    const cell = grid.cells[k];
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.col > maxCol) maxCol = cell.col;
  });
  return { maxRow: maxRow + 1, maxCol: maxCol + 1 };
}

export function exportToSVG(grid: GridState, title = 'Texel Export') {
  const { maxRow, maxCol } = getPopulatedBounds(grid);

  const colWidths: number[] = [];
  let totalWidth = 0;
  for (let c = 0; c < maxCol; c++) {
    const w = grid.colWidths[c] ?? DEFAULT_COL_WIDTH;
    colWidths.push(w);
    totalWidth += w;
  }

  const rowHeights: number[] = [];
  let totalHeight = 0;
  for (let r = 0; r < maxRow; r++) {
    const h = grid.rowHeights[r] ?? DEFAULT_ROW_HEIGHT;
    rowHeights.push(h);
    totalHeight += h;
  }

  const padding = 16;
  const svgWidth = totalWidth + padding * 2;
  const svgHeight = totalHeight + padding * 2;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`
  );
  lines.push(`<rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff"/>`); 
  lines.push(`<style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #1a1a1a; }
    .cell-bg { stroke: #d0d0d0; stroke-width: 1; }
    .h1 { font-size: 18px; font-weight: bold; }
    .h2 { font-size: 15px; font-weight: bold; }
    .h3 { font-size: 13px; font-weight: bold; }
    .body { font-size: 12px; }
    .dim { fill: #666; }
  </style>`);

  // Draw cells
  let y = padding;
  for (let r = 0; r < maxRow; r++) {
    let x = padding;
    for (let c = 0; c < maxCol; c++) {
      const w = colWidths[c];
      const h = rowHeights[r];
      const cell = grid.cells[cellKey(r, c)];
      const bgFill = cell?.color ?? '#ffffff';

      lines.push(`<rect class="cell-bg" x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgFill}"/>`);


      if (cell?.content) {
        // Naive markdown-to-SVG: render line by line, detect headings
        const rawLines = cell.content.split('\n').slice(0, Math.floor(h / 16));
        let ty = y + 16;
        for (const rawLine of rawLines) {
          if (ty > y + h - 4) break;
          let cls = 'body';
          let displayText = rawLine;
          if (rawLine.startsWith('### ')) { cls = 'h3'; displayText = rawLine.slice(4); }
          else if (rawLine.startsWith('## ')) { cls = 'h2'; displayText = rawLine.slice(3); }
          else if (rawLine.startsWith('# ')) { cls = 'h1'; displayText = rawLine.slice(2); }
          else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
            displayText = '• ' + rawLine.slice(2);
          }
          // Escape XML
          const escaped = displayText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          const clipW = w - 16;
          lines.push(
            `<text class="${cls}" x="${x + 8}" y="${ty}" width="${clipW}" clip-path="url(#CP_${r}_${c})">${escaped}</text>`
          );
          ty += cls === 'h1' ? 22 : cls === 'h2' ? 18 : cls === 'h3' ? 16 : 15;
        }
      }

      x += w;
    }
    y += rowHeights[r];
  }

  lines.push(`</svg>`);
  const svgContent = lines.join('\n');
  saveFile(svgContent, `${title}.svg`, 'image/svg+xml');
}

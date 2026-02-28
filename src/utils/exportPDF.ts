import { GridState, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, cellKey } from '../types';
import jsPDF from 'jspdf';

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

/** Scale px -> pt (72pt/96px) */
const PX_TO_PT = 72 / 96;

/** Parse a 6-digit hex colour string to {r,g,b} (falls back to white). */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

export function exportToPDF(grid: GridState, title = 'Texel Export') {
  const { maxRow, maxCol } = getPopulatedBounds(grid);

  const colWidths: number[] = [];
  let totalWidthPx = 0;
  for (let c = 0; c < maxCol; c++) {
    const w = grid.colWidths[c] ?? DEFAULT_COL_WIDTH;
    colWidths.push(w);
    totalWidthPx += w;
  }

  const rowHeights: number[] = [];
  let totalHeightPx = 0;
  for (let r = 0; r < maxRow; r++) {
    const h = grid.rowHeights[r] ?? DEFAULT_ROW_HEIGHT;
    rowHeights.push(h);
    totalHeightPx += h;
  }

  // Convert to points
  const pageW = totalWidthPx * PX_TO_PT + 40;
  const pageH = totalHeightPx * PX_TO_PT + 40;

  const doc = new jsPDF({
    orientation: pageW > pageH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [pageW, pageH],
  });

  // Background — always light for print
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  const pad = 20; // pt
  let y = pad;

  for (let r = 0; r < maxRow; r++) {
    const rh = rowHeights[r] * PX_TO_PT;
    let x = pad;
    for (let c = 0; c < maxCol; c++) {
      const cw = colWidths[c] * PX_TO_PT;
      const cell = grid.cells[cellKey(r, c)];

      // Cell background — use cell colour when present, otherwise white for print
      const bg = cell?.color ? hexToRgb(cell.color) : { r: 255, g: 255, b: 255 };
      doc.setFillColor(bg.r, bg.g, bg.b);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(x, y, cw, rh, 'FD');

      if (cell?.content) {
        doc.setTextColor(26, 26, 26);
        const lines = cell.content.split('\n');
        let ty = y + 12;

        for (const rawLine of lines) {
          if (ty > y + rh - 6) break;
          let size = 9;
          let bold = false;
          let displayText = rawLine;

          if (rawLine.startsWith('# ')) {
            size = 14; bold = true; displayText = rawLine.slice(2);
          } else if (rawLine.startsWith('## ')) {
            size = 12; bold = true; displayText = rawLine.slice(3);
          } else if (rawLine.startsWith('### ')) {
            size = 10; bold = true; displayText = rawLine.slice(4);
          } else if (rawLine.startsWith('**') && rawLine.endsWith('**')) {
            bold = true; displayText = rawLine.slice(2, -2);
          } else if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
            displayText = '\u2022 ' + rawLine.slice(2);
          }

          doc.setFontSize(size);
          doc.setFont('helvetica', bold ? 'bold' : 'normal');

          const maxW = cw - 12;
          const textLines = doc.splitTextToSize(displayText, maxW);
          for (const tl of textLines) {
            if (ty > y + rh - 6) break;
            doc.text(tl, x + 6, ty, { maxWidth: maxW });
            ty += size + 2;
          }
        }
      }

      x += cw;
    }
    y += rh;
  }

  doc.save(`${title}.pdf`);
}

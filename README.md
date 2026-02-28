# Texel

A markdown-powered spreadsheet canvas. Like a spreadsheet, but every cell holds **rich formatted text** written in Markdown — not formulas.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Stack](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![Stack](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Stack](https://img.shields.io/badge/Electron-28-47848F?logo=electron)

---

## What is Texel?

Texel gives you an infinite grid of cells, each one a small Markdown document. You can:

- Write notes, headers, bullet lists, code blocks, and bold/italic text using standard Markdown
- Drag and drop cell contents between any cells
- Resize rows and columns by dragging their edges, or use **Auto-fit** to size everything to content
- Apply **background colours** to individual cells or entire ranges
- Navigate with the keyboard, select ranges, and copy/paste — including to/from Excel
- Insert or delete rows and columns via right-click on the headers
- Switch between a **dark** and **light** theme
- Save your work as a `.texel` file (JSON) and reopen it later
- Export the grid as **SVG** or **PDF** for sharing or printing (background colours are included in exports)

Think of it as a spatial notebook — structured like a spreadsheet, but a writing tool at heart.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

### Install

```bash
git clone https://github.com/your-username/texel.git
cd texel
npm install
```

### Run in the browser (web mode)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run as a desktop app (Electron)

```bash
npm run electron:dev
```

This starts the Vite dev server and launches the Electron window simultaneously.

### Build for production

```bash
npm run build          # web build → dist/
npm run electron:build # desktop installer → release/
```

---

## Using Texel

### Editing cells

| Action | How |
|--------|-----|
| Enter edit mode | Double-click a cell, or select it with arrow keys and press **Enter** |
| Confirm edit | **Ctrl+Enter**, **Shift+Enter**, or click outside the cell |
| Cancel edit | **Escape** |
| Live resize | The cell expands automatically as you type |

### Keyboard navigation

| Key | Action |
|-----|--------|
| **Arrow keys** | Move selection one cell |
| **Shift+Arrow** | Extend the selection range |
| **Tab** | Move one cell right |
| **Enter** | Open selected cell for editing |
| **Escape** | Clear selection |

### Selection and clipboard

| Action | How |
|--------|-----|
| Select a cell | Click it |
| Extend selection | Shift+click, or Shift+Arrow keys |
| Copy | **Ctrl+C** — compatible with Excel/LibreOffice |
| Cut | **Ctrl+X** |
| Paste | **Ctrl+V** — paste from Excel works cell-by-cell |

### Background colours

Select one or more cells — a fill toolbar appears below the main toolbar:

- Click any of the **8 colour swatches** to apply immediately
- Use the **colour picker** to choose a custom colour, then click **Apply**
- Click **Clear** to remove the background from the selected cells
- Cells with a custom background always display **black text** regardless of the app theme
- Background colours are preserved in SVG and PDF exports

### Rows and columns

| Action | How |
|--------|-----|
| Resize a column | Drag the right edge of a column header |
| Resize a row | Drag the bottom edge of a row number |
| Auto-fit all | Toolbar → **Auto-fit** |
| Insert / delete | **Right-click** any row number or column letter |

### Drag and drop

Drag the `≡` handle (top-right corner of a filled cell) to move its contents to another cell.

### File and export

| Action | How |
|--------|-----|
| New document | Toolbar → **New** |
| Open a file | Toolbar → **Open** (accepts `.texel` / `.json`) |
| Save | Toolbar → **Save JSON** (downloads a `.texel` file) |
| Export SVG | Toolbar → **Export SVG** |
| Export PDF | Toolbar → **Export PDF** |
| Toggle theme | Toolbar → **☀ / 🌙** button |

### Markdown quick reference

| Syntax | Result |
|--------|--------|
| `# Heading` | Large heading |
| `## Heading` | Medium heading |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `- item` | Bullet list |
| `` `code` `` | Inline code |
| `> quote` | Block quote |
| `[link](url)` | Hyperlink |

---

## File Format

Files are saved as JSON with a `.texel` extension:

```json
{
  "version": 1,
  "metadata": {
    "title": "My Notes",
    "createdAt": "2026-02-28T12:00:00.000Z",
    "updatedAt": "2026-02-28T12:00:00.000Z"
  },
  "grid": {
    "cells": {
      "0-0": { "id": "uuid", "row": 0, "col": 0, "content": "# Hello", "color": "#ffe033" }
    },
    "rowHeights": { "0": 150 },
    "colWidths": { "0": 300 },
    "numRows": 20,
    "numCols": 10
  }
}
```

The optional `color` field on a cell stores a hex background colour.

---

## Project Structure

```
texel/
├── src/
│   ├── App.tsx                   Root component — owns title, theme, and wires all handlers
│   ├── index.css                 CSS custom properties (dark/light theme) + Markdown styles
│   ├── components/
│   │   ├── Grid.tsx              Table grid, sticky headers, DnD, selection, keyboard nav,
│   │   │                         copy/paste, context menu, fill toolbar
│   │   ├── Cell.tsx              Single cell: view (ReactMarkdown) + edit (textarea),
│   │   │                         live resize, drag handle, colour overlay
│   │   ├── Toolbar.tsx           Top bar: title, file actions, export, auto-fit, theme toggle
│   │   └── ResizeHandle.tsx      Drag-to-resize handles for rows and columns
│   ├── hooks/
│   │   └── useGrid.ts            All grid state: cells, sizes, CRUD, insert/delete, colours
│   ├── utils/
│   │   ├── fileIO.ts             JSON save/load and browser file dialog
│   │   ├── autoFit.ts            Canvas + DOM measurement for auto-fit sizing
│   │   ├── exportSVG.ts          SVG export (includes cell background colours)
│   │   └── exportPDF.ts          PDF export via jsPDF (includes cell background colours)
│   └── types/
│       └── index.ts              Shared TypeScript interfaces and constants
├── electron/
│   ├── main.ts                   Electron main process
│   └── preload.ts                contextBridge (exposes platform string)
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript 5 | Type safety |
| Vite 5 | Dev server and bundler |
| Electron 28 | Desktop shell |
| @dnd-kit/core + @dnd-kit/modifiers | Drag and drop |
| react-markdown + remark-gfm | Markdown rendering |
| jsPDF | PDF export |
| uuid | Stable cell identity |

---

## Known Limitations

- SVG and PDF export use naive line-by-line Markdown parsing — inline bold/italic is not rendered, only block-level syntax (headings, lists) is detected.
- The grid renders all rows and columns in the DOM (no virtualisation). For very large grids (>100 rows × >50 cols), consider adding `@tanstack/react-virtual`.
- Electron native file dialogs are not yet implemented — the app uses browser-based file input and Blob download in both web and desktop modes.
- Undo/redo is not yet implemented.

---

## License

MIT


---

## What is Texel?

Texel gives you an infinite grid of cells, each one a small Markdown document. You can:

- Write notes, headers, bullet lists, code blocks, and bold/italic text using standard Markdown syntax
- Drag and drop cell contents between any cells in the grid
- Resize rows and columns freely by dragging their edges
- Save your work as a `.texel` file (JSON) and reopen it later
- Export the grid as **SVG** or **PDF** for sharing or printing

Think of it as a spatial notebook — structured like a spreadsheet, but a writing tool at heart.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

### Install

```bash
git clone https://github.com/your-username/texel.git
cd texel
npm install
```

### Run in the browser (web mode)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run as a desktop app (Electron)

```bash
npm run electron:dev
```

This starts the Vite dev server and launches the Electron window simultaneously.

### Build for production

```bash
npm run build          # web build → dist/
npm run electron:build # desktop installer → release/
```

---

## Using Texel

| Action | How to do it |
|--------|-------------|
| **Edit a cell** | Double-click any cell |
| **Confirm edit** | Click outside the cell, or press **Ctrl+Enter** |
| **Cancel edit** | Press **Escape** |
| **Move a cell** | Drag the `≡` handle (top-right of a filled cell) to another cell |
| **Resize a column** | Hover the right edge of a column header, then drag |
| **Resize a row** | Hover the bottom edge of a row number, then drag |
| **New document** | Toolbar → **New** |
| **Open a file** | Toolbar → **Open** (accepts `.texel` or `.json`) |
| **Save** | Toolbar → **Save JSON** (downloads a `.texel` file) |
| **Export SVG** | Toolbar → **Export SVG** |
| **Export PDF** | Toolbar → **Export PDF** |

### Markdown quick reference

| Syntax | Result |
|--------|--------|
| `# Heading` | Large heading |
| `## Heading` | Medium heading |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `- item` | Bullet list |
| `` `code` `` | Inline code |
| `> quote` | Block quote |

---

## File Format

Files are saved as JSON with a `.texel` extension:

```json
{
  "version": 1,
  "metadata": {
    "title": "My Notes",
    "createdAt": "2026-02-28T12:00:00.000Z",
    "updatedAt": "2026-02-28T12:00:00.000Z"
  },
  "grid": {
    "cells": {
      "0-0": { "id": "uuid", "row": 0, "col": 0, "content": "# Hello\nWorld" }
    },
    "rowHeights": { "0": 150 },
    "colWidths": { "0": 300 },
    "numRows": 20,
    "numCols": 10
  }
}
```

---

## Project Structure

```
texel/
├── src/
│   ├── App.tsx                   Root component
│   ├── index.css                 Global styles and CSS variables
│   ├── components/
│   │   ├── Grid.tsx              Scrollable grid with sticky headers
│   │   ├── Cell.tsx              Individual cell (view + edit mode)
│   │   ├── Toolbar.tsx           Top toolbar with file and export actions
│   │   └── ResizeHandle.tsx      Drag-to-resize handles for rows and columns
│   ├── hooks/
│   │   └── useGrid.ts            Grid state management hook
│   ├── utils/
│   │   ├── fileIO.ts             JSON save/load and browser file dialog
│   │   ├── exportSVG.ts          SVG export
│   │   └── exportPDF.ts          PDF export via jsPDF
│   └── types/
│       └── index.ts              Shared TypeScript types and constants
├── electron/
│   ├── main.ts                   Electron main process
│   └── preload.ts                Electron preload script
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript 5 | Type safety |
| Vite 5 | Dev server and bundler |
| Electron 28 | Desktop shell |
| @dnd-kit/core | Drag and drop |
| react-markdown | Markdown rendering |
| remark-gfm | GitHub Flavored Markdown support |
| jsPDF | PDF export |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Double-click** | Enter edit mode |
| **Ctrl+Enter** | Confirm edit |
| **Escape** | Cancel edit |

---

## License

MIT

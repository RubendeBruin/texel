# Texel

A markdown-powered spreadsheet canvas. Like a spreadsheet, but every cell holds **rich formatted text** written in Markdown — not formulas.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Stack](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript) ![Stack](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Stack](https://img.shields.io/badge/Electron-28-47848F?logo=electron)

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

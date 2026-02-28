# AGENTS.md — Texel Codebase Guide for AI Agents

This file describes the architecture, data model, conventions, and extension points of the Texel codebase. Read this before making changes.

---

## Purpose

Texel is a **markdown spreadsheet canvas** — an infinite grid where each cell holds Markdown text. It is a web app (React + Vite) that also ships as a desktop app (Electron). There are no formulas, no computed values — only content.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI framework | React | 18 |
| Language | TypeScript | 5 |
| Bundler / dev server | Vite | 5 |
| Desktop shell | Electron | 28 |
| Drag and drop | @dnd-kit/core + @dnd-kit/modifiers | 6 |
| Markdown rendering | react-markdown + remark-gfm | 9 / 4 |
| PDF export | jsPDF | 2 |
| ID generation | uuid | 9 |

---

## File Tree

```
texel/
├── src/
│   ├── main.tsx                  React entry point (ReactDOM.createRoot)
│   ├── App.tsx                   Root component — owns all state + handlers
│   ├── index.css                 CSS custom properties (design tokens) + markdown styles
│   ├── components/
│   │   ├── Grid.tsx              Grid rendering: <table> with sticky thead/td, DnD context
│   │   ├── Cell.tsx              Single cell: view mode (ReactMarkdown) + edit mode (textarea)
│   │   ├── Toolbar.tsx           Top bar: document title input + action buttons
│   │   └── ResizeHandle.tsx      Col and row resize via mousedown drag
│   ├── hooks/
│   │   └── useGrid.ts            All grid state: cells map, row/col sizes, CRUD operations
│   ├── utils/
│   │   ├── fileIO.ts             JSON serialisation, browser file open/save dialog
│   │   ├── exportSVG.ts          Renders grid to SVG string, triggers download
│   │   └── exportPDF.ts          Renders grid to PDF via jsPDF, triggers download
│   └── types/
│       └── index.ts              Core interfaces + shared constants
├── electron/
│   ├── main.ts                   BrowserWindow creation, dev vs prod URL switching
│   └── preload.ts                contextBridge exposure (currently: platform string only)
├── index.html
├── vite.config.ts                path alias @/ → src/, base: './' for Electron compat
├── tsconfig.json
└── package.json
```

---

## Core Data Model

Defined in `src/types/index.ts`.

```typescript
interface CellData {
  id: string;       // uuid — stable identity across moves
  row: number;      // 0-based row index
  col: number;      // 0-based column index
  content: string;  // raw Markdown text
}

interface GridState {
  cells: Record<string, CellData>;     // keyed by cellKey(row, col) → "row-col"
  rowHeights: Record<number, number>;  // sparse — only rows with non-default heights
  colWidths: Record<number, number>;   // sparse — only cols with non-default widths
  numRows: number;                     // current grid height (grows automatically)
  numCols: number;                     // current grid width (grows automatically)
}
```

### Key helpers

```typescript
cellKey(row, col)         // → "row-col", used as cells map key
DEFAULT_COL_WIDTH = 200   // px, used when colWidths[c] is undefined
DEFAULT_ROW_HEIGHT = 120  // px, used when rowHeights[r] is undefined
INITIAL_ROWS = 20
INITIAL_COLS = 10
```

Cell lookup pattern used everywhere:
```typescript
const cell = grid.cells[cellKey(row, col)]; // undefined if empty
```

---

## State Management

All grid state lives in `src/hooks/useGrid.ts` via a single `useState<GridState>`.

### Key operations

| Function | Behaviour |
|----------|-----------|
| `setCell(row, col, content)` | Upsert cell. Deletes entry if content is `''`. Expands numRows/numCols if write is near edge. |
| `moveCell(fromRow, fromCol, toRow, toCol)` | Removes source, writes to target (overwrites). Assign new uuid on move. |
| `swapCells(r1, c1, r2, c2)` | Swaps two cells bidirectionally. |
| `setRowHeight(row, height)` | Clamps to min 40px. |
| `setColWidth(col, width)` | Clamps to min 80px. |
| `loadGrid(GridState)` | Replaces state entirely (used on file open). |
| `clearGrid()` | Resets to initial empty state. |

`getCell`, `getRowHeight`, `getColWidth` are memoised with `useCallback`.

---

## Component Architecture

### `App.tsx`

- Owns `title` state (document name).
- Instantiates `useGrid()` and passes all returned functions down.
- Hosts all file I/O and export handlers.
- Renders `<Toolbar>` + `<Grid>`.

### `Grid.tsx`

- Renders a `<table>` inside a scrollable `div` (flex: 1, overflow: auto).
- `<thead>` holds the column headers — `position: sticky; top: 0`.
- Each `<td>` in column 0 of `<tbody>` is the row header — `position: sticky; left: 0`.
- Wraps everything in `<DndContext>` from `@dnd-kit/core`.
- `colLabel(col)` converts 0-based index to A, B, …, Z, AA, AB, … spreadsheet-style labels.
- On `DragEnd`, reads `event.active.data.current` (source) and `event.over.data.current` (target) to call `moveCell`.

### `Cell.tsx`

- Two modes: **view** (renders `<ReactMarkdown>`) and **edit** (renders `<textarea class="cell-editor">`).
- Double-click → edit. Click outside (onBlur) or Ctrl+Enter → commit. Escape → cancel.
- Uses both `useDraggable` (drag source, disabled while editing) and `useDroppable` (drop target) on the same element via a combined ref callback.
- The drag handle (the `≡` icon) receives `dragAttrs` and `dragListeners` — it is the actual drag initiator. Dragging detaches from the cell div so the pointer sensor has a clean 6px distance threshold.
- `isDragging` sets `opacity: 0.4` on the source cell while dragged.
- `isOver` styles the drop target with a purple tint and accent border.

### `Toolbar.tsx`

Purely presentational. Emits callbacks: `onNew`, `onSave`, `onLoad`, `onExportSVG`, `onExportPDF`, `onTitleChange`.

### `ResizeHandle.tsx`

- `ColResizeHandle` — absolutely positioned 5px-wide div on the right edge of each `<th>`. `mousedown` → records start X and width → `mousemove` delta → calls `onResize(col, newWidth)` → `mouseup` cleans up listeners.
- `RowResizeHandle` — same pattern, vertical, on bottom edge of row header `<td>`.
- Both attach/remove listeners on `document` (not on the element) so dragging outside the element works.

---

## File I/O

`src/utils/fileIO.ts`

- `gridToJson(grid, title)` — wraps `GridState` in a `TexelFile` envelope (version, metadata) and serialises to JSON string.
- `jsonToGrid(json)` — parses and validates (checks `version` and `grid` keys exist).
- `saveFile(content, filename, mime)` — creates a `Blob`, a temporary `<a>` tag, clicks it, revokes URL.
- `openFileDialog()` — creates a hidden `<input type="file">`, returns a `Promise<string>` that resolves with the file text.

Files use the `.texel` extension (MIME: `application/json`).

---

## Export

### SVG (`src/utils/exportSVG.ts`)

- Computes the bounding box of populated cells only (`getPopulatedBounds`).
- Builds an SVG string manually (no DOM, no canvas). Outputs `<rect>` for each cell background plus `<text>` elements per line of content.
- Naive Markdown parsing: detects `# `, `## `, `### ` headings and `- `/`* ` list prefixes. Bold/italic is not rendered (SVG text does not support inline formatting without `<tspan>`).
- Triggers download via `saveFile`.

### PDF (`src/utils/exportPDF.ts`)

- Uses `jsPDF` in user-unit `pt` mode.
- Converts pixel dimensions to points via `PX_TO_PT = 72/96`.
- Same naive Markdown parsing as SVG. `jsPDF.splitTextToSize` handles line wrapping within cell width.
- Page dimensions are computed from grid content size — one large page, not paginated.

---

## CSS Design Tokens

All colours and layout dimensions are CSS custom properties on `:root` in `src/index.css`:

```css
--bg            #1a1a2e   Page background
--surface       #16213e   Toolbar and header background
--surface2      #0f3460   (accent surface, scrollbar)
--accent        #e94560   Red accent (selection, TEXEL logo)
--accent2       #533483   Purple accent (drag over, resize hover)
--text          #eaeaea   Primary text
--text-dim      #888      Row/col header labels, placeholders
--border        #2a2a4a   Structural borders
--cell-bg       #1e1e32   Default cell background
--cell-bg-hover #252545   Cell hover
--cell-bg-selected #1a2a4a  Selected cell background
--cell-border   #2e2e52   Cell border
--toolbar-h     48px
--col-header-h  28px
--row-header-w  52px      (defined as JS const in Grid.tsx, not CSS)
```

The `.md-rendered` class in `index.css` styles the rendered Markdown inside cells (headings, lists, code, blockquotes, links).

The `.cell-editor` class styles the `<textarea>` used in edit mode (monospace font, dark background, no border/outline).

---

## Electron Integration

`electron/main.ts`:
- In dev (`NODE_ENV === 'development'` or not packaged): loads `http://localhost:5173`.
- In production: loads `dist/index.html` (relative, so `base: './'` in Vite config is critical).
- `preload.ts` exposes `window.texelAPI.platform` via `contextBridge`. Currently unused by the renderer.

Build command: `npm run electron:build` → uses `electron-builder`, outputs to `release/`.

---

## Adding Features — Where to Touch

| Feature | Files to modify |
|---------|----------------|
| New cell formatting (e.g. checkboxes) | `src/components/Cell.tsx` (view render), `src/index.css` (`.md-rendered` styles) |
| New toolbar action | `src/components/Toolbar.tsx` (add button + prop), `src/App.tsx` (add handler) |
| New export format | Create `src/utils/exportXYZ.ts`, add button in `Toolbar`, wire handler in `App.tsx` |
| Persist to localStorage | `src/hooks/useGrid.ts` — add `useEffect` saving on change, load in initialiser |
| Cell selection range (multi-select) | `src/components/Grid.tsx` (selection state), `src/components/Cell.tsx` (isSelected logic) |
| Keyboard navigation | `src/components/Grid.tsx` — listen for arrow keys on the scroll container |
| Cell background colour | Add `color?: string` to `CellData` in `src/types/index.ts`, propagate through hooks and Cell render |
| Native file dialogs (Electron) | `electron/main.ts` — add `ipcMain.handle('save-file', …)` using `dialog.showSaveDialog`; `electron/preload.ts` — expose via `contextBridge`; `src/utils/fileIO.ts` — detect `window.texelAPI` and branch |
| Undo/redo | Replace `useState<GridState>` in `useGrid.ts` with a history stack (`past[]`, `present`, `future[]`) |

---

## Conventions

- **Cell keys** are always `"${row}-${col}"` strings. Never construct them manually — use `cellKey(row, col)` from `src/types/index.ts`.
- **Empty cells are absent** from `grid.cells`. Do not store `{ content: '' }`.
- **Row/column sizes are sparse** — only non-default values are stored. Always use `getRowHeight(r)` / `getColWidth(c)` hooks (which apply defaults) rather than reading `grid.rowHeights[r]` directly.
- **No global store** — state flows from `App.tsx` down via props. Do not add Redux, Zustand, or Context unless the prop-drilling becomes genuinely unmanageable.
- **Exports are stateless utilities** — `exportSVG` and `exportPDF` receive `GridState` and produce a download. They do not call React hooks.
- **TypeScript strict mode is enabled** — all new code must compile with zero errors. Run `npx tsc --noEmit` to check.

---

## Scripts

```bash
npm run dev             # Vite dev server (web only) → http://localhost:5173
npm run build           # tsc + vite build → dist/
npm run preview         # Serve dist/ locally
npm run electron:dev    # Vite dev server + Electron window (concurrently)
npm run electron:build  # Full desktop build → release/
```

---

## Known Limitations

- SVG and PDF export use naive line-by-line Markdown parsing — inline bold/italic is not rendered, only block-level syntax (headings, lists) is detected.
- Column width changes do not trigger re-layout in the `<table>` until the next React render (Vite HMR or state update). This is by design — React drives width via inline styles.
- The grid always renders all rows and columns in the DOM (no virtualisation). For very large grids (>100 rows × >50 cols with content), consider adding `react-virtual` or `@tanstack/react-virtual`.
- Electron native file dialogs (open/save) are not yet implemented — the app currently uses browser-based file input and Blob download in both web and desktop modes.

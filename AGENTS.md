# AGENTS.md — Texel Codebase Guide for AI Agents

This file describes the architecture, data model, conventions, and extension points of the Texel codebase. Read this before making changes.

---

## Purpose

Texel is a **markdown spreadsheet canvas** — an infinite grid where each cell holds Markdown text. It is a web app (React + Vite) that also ships as a desktop app (Electron). There are no formulas, no computed values — only content and layout.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|--------|
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
│   ├── App.tsx                   Root component — owns title + theme state, wires all handlers
│   ├── index.css                 CSS custom properties (dark/light theme tokens) + markdown styles
│   ├── components/
│   │   ├── Grid.tsx              Grid rendering, selection, keyboard nav, copy/paste, context menu, fill toolbar
│   │   ├── Cell.tsx              Single cell: view (ReactMarkdown) + edit (textarea), live resize, colour overlay
│   │   ├── Toolbar.tsx           Top bar: title, file/export actions, auto-fit, theme toggle
│   │   └── ResizeHandle.tsx      Col and row resize via mousedown drag
│   ├── hooks/
│   │   └── useGrid.ts            All grid state: cells map, row/col sizes, CRUD, insert/delete rows/cols, colours
│   ├── utils/
│   │   ├── fileIO.ts             JSON serialisation, browser file open/save dialog
│   │   ├── autoFit.ts            Canvas + hidden-DOM measurement for auto-fit sizing
│   │   ├── exportSVG.ts          Renders grid to SVG string (respects cell colours), triggers download
│   │   └── exportPDF.ts          Renders grid to PDF via jsPDF (respects cell colours), triggers download
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
  color?: string;   // optional background fill colour (hex, e.g. "#ffe033")
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
| `setCell(row, col, content)` | Upsert cell. If content is `''` and no colour, deletes entry. If colour exists, keeps entry with empty content. Expands numRows/numCols near edge. |
| `setCellColors(positions, color)` | Batch-set or clear background colour on an array of positions. Passing `undefined` removes the colour; deletes cell entry if it also has no content. |
| `moveCell(fromRow, fromCol, toRow, toCol)` | Removes source, writes to target (overwrites). Assigns new uuid on move. |
| `swapCells(r1, c1, r2, c2)` | Swaps two cells bidirectionally. |
| `setRowHeight(row, height)` | Clamps to min 40px. |
| `setColWidth(col, width)` | Clamps to min 80px. |
| `setAllColWidths(widths)` | Batch-replace col widths (used by auto-fit). |
| `setAllRowHeights(heights)` | Batch-replace row heights (used by auto-fit). |
| `insertRow(at)` | Inserts a blank row at index `at`; shifts all cells, rowHeights below it down by 1. |
| `deleteRow(at)` | Deletes row `at`; shifts cells and rowHeights above it up by 1. Minimum 1 row kept. |
| `insertCol(at)` | Inserts a blank column at index `at`; shifts all cells, colWidths right of it by 1. |
| `deleteCol(at)` | Deletes column `at`; shifts cells and colWidths left by 1. Minimum 1 col kept. |
| `loadGrid(GridState)` | Replaces state entirely (used on file open). |
| `clearGrid()` | Resets to initial empty state. |

`getCell`, `getRowHeight`, `getColWidth` are memoised with `useCallback`.

---

## Component Architecture

### `App.tsx`

- Owns `title` state (document name) and `theme: 'dark' | 'light'` state.
- Theme is applied via `document.documentElement.setAttribute('data-theme', theme)` which triggers CSS variable overrides in `index.css`.
- Instantiates `useGrid()` and passes all returned functions down as props.
- Hosts all file I/O, export, and auto-fit handlers.
- Renders `<Toolbar>` + `<Grid>`.

### `Grid.tsx`

- Renders a `<table>` inside a focusable, scrollable `div` (`tabIndex={0}`, `overflow: auto`).
- `<thead>` holds column headers — `position: sticky; top: 0`. `<td>` in column 0 of `<tbody>` is the row header — `position: sticky; left: 0`.
- Wraps everything in `<DndContext>` from `@dnd-kit/core`.
- `colLabel(col)` converts 0-based index to A, B, …, Z, AA, AB, … spreadsheet labels.

**Selection model:**
- `anchor: Pos | null` — the primary (first-clicked / navigated-to) cell.
- `selectionEnd: Pos | null` — the opposite corner of the range, set by Shift+click or Shift+Arrow.
- `selRect = getRect(anchor, selectionEnd)` — normalised `{minRow, maxRow, minCol, maxCol}`.
- `inRect(selRect, r, c)` — used per-cell to determine `isSelected`.
- Row/col headers highlight in accent colour when any cell in their band is selected.

**Keyboard handler** (`handleGridKeyDown` on the scroll div):
- Arrow keys move anchor (or extend selectionEnd when Shift held).
- Enter → `setPendingEdit(true)` which triggers the anchor cell's `autoEdit` prop.
- Escape → clears selection.
- Tab → move right.
- **Ctrl/Meta+C** → serialize selection to TSV, write to `navigator.clipboard`.
- **Ctrl/Meta+X** → same as copy, then clears cell contents.
- **Ctrl/Meta+V** → `navigator.clipboard.readText()`, parse TSV, write cells starting at anchor.

**Context menu:**
- Right-click on a row header → `openRowMenu` → `ctxMenu` state set to `{kind:'row', index, x, y}`.
- Right-click on a col header → `openColMenu` → `ctxMenu` state set to `{kind:'col', index, x, y}`.
- Menu rendered as a `position:fixed` div at the pointer coordinates.
- Dismisses on any `pointerdown` outside via a document-level listener.
- Actions: insert above/below (rows) or left/right (cols), delete.

**Fill colour toolbar:**
- Rendered between the main toolbar and the grid when `anchor !== null`.
- Contains 8 preset swatches (clicking immediately applies and updates `fillColor`), a `<input type="color">` custom picker, Apply and Clear buttons, and a cell-count badge.

**DnD:**
- `DragOverlay dropAnimation={null}` — prevents the reversed-animation bug.
- Drag source identified via `event.active.data.current`; drop target via `event.over.data.current`.

### `Cell.tsx`

- Two modes: **view** (`<ReactMarkdown>`) and **edit** (`<textarea className="cell-editor">`).
- Double-click → edit. Blur → commit. Ctrl+Enter or Shift+Enter → commit + call `onEditEnd()`. Escape → cancel + call `onEditEnd()`.
- `autoEdit` prop: when `true`, the cell enters edit mode immediately (triggered by Enter key in Grid); calls `onAutoEditHandled()` so Grid resets the flag.
- `onEditEnd()` returns keyboard focus to the grid scroll container so arrow-key navigation continues without a click.
- `cellColor` prop: when set, the cell's background uses that colour and a set of CSS custom property overrides force all text to near-black (`#111`) for readability. Applied as inline style on the outer div so the `--text`, `--text-dim`, `--code-bg`, `--pre-bg`, etc. vars are scoped to that cell.
- **Live resize** on every `onChange`:
  - Row height: `ta.style.height = 'auto'` → read `scrollHeight` → restore (avoids inflation bug) → call `onResizeRow`.
  - Col width: canvas `measureText` on the longest line → call `onResizeCol`.
- Uses both `useDraggable` and `useDroppable` on the same element via a combined ref callback.
- The `≡` drag handle receives `dragAttrs + dragListeners`; dragging is disabled while editing.

### `Toolbar.tsx`

Purely presentational. Props: `{title, onTitleChange, onNew, onSave, onLoad, onExportSVG, onExportPDF, onAutoFit, theme, onToggleTheme}`.

Button order: **New** | **Open** | **Save JSON** | — | **Auto-fit** | — | **Export SVG** | **Export PDF** | — | **☀/🌙**

### `ResizeHandle.tsx`

- `ColResizeHandle` — absolutely positioned 5px-wide div on the right edge of each `<th>`. `mousedown` → records start X and current width → `mousemove` delta → calls `onResize(col, newWidth)` → `mouseup` cleans up.
- `RowResizeHandle` — same pattern, vertical, on bottom edge of row-header `<td>`.
- Both attach/remove listeners on `document` (not the element) so dragging outside the element works.

---

## Clipboard / TSV Format

`src/components/Grid.tsx` — `tsvEscapeCell` and `parseTSV` helpers (module-level, not exported).

- Copy/cut serialise the selection as Tab-Separated Values with `\r\n` row separators — identical to what Excel writes to the clipboard.
- Fields containing tabs, newlines, or double-quotes are RFC-4180 quoted.
- `parseTSV` is a full state-machine parser supporting quoted fields, escaped `""`, and CRLF line endings.
- Paste reads `navigator.clipboard.readText()` and writes cells starting at `anchor`.

---

## Auto-fit

`src/utils/autoFit.ts`

- `computeAutoColWidths(grid)` — creates a hidden `<span>` in the document with the cell's monospace font, measures each non-empty cell's stripped-Markdown lines, returns the widest per column.
- `computeAutoRowHeights(grid, colWidths)` — creates a hidden `<div>` constrained to the column width, sets `innerHTML`, reads `scrollHeight`.
- Both clamp to MIN/MAX bounds.
- `App.tsx` calls both in sequence, passing the fresh col widths (not the stale state) to row height measurement.

---

## File I/O

`src/utils/fileIO.ts`

- `gridToJson(grid, title)` — wraps `GridState` in a `TexelFile` envelope (version, metadata) and serialises to JSON string.
- `jsonToGrid(json)` — parses and validates (checks `version` and `grid` keys exist).
- `saveFile(content, filename, mime)` — creates a `Blob`, a temporary `<a>` tag, clicks it, revokes URL.
- `openFileDialog()` — creates a hidden `<input type="file">`, returns a `Promise<string>`.

Files use the `.texel` extension (MIME: `application/json`).

---

## Export

### SVG (`src/utils/exportSVG.ts`)

- Computes the bounding box of populated cells only (`getPopulatedBounds`).
- Builds an SVG string manually. Outputs one `<rect>` per cell with `fill` set to `cell.color ?? '#ffffff'`.
- **Important:** cell background colour is set as an inline `fill` attribute, not via the CSS class. The `.cell-bg` class must NOT include a `fill` property, as CSS overrides presentation attributes in SVG.
- Naive Markdown parsing: `# `, `## `, `### ` headings and `- `/`* ` list prefixes. Bold/italic not rendered.
- Triggers download via `saveFile`.

### PDF (`src/utils/exportPDF.ts`)

- Uses `jsPDF` in `pt` units. `PX_TO_PT = 72/96`.
- `hexToRgb(hex)` parses a 6-digit hex colour string to `{r,g,b}` for `doc.setFillColor()`.
- Cell background: `cell.color` is converted via `hexToRgb`, or defaults to white.
- Same naive Markdown parsing as SVG. `jsPDF.splitTextToSize` handles line wrapping.
- One large page sized to the content — not paginated.

---

## Theming

`src/index.css` defines all colour tokens as CSS custom properties on `:root` (dark theme defaults). A `html[data-theme="light"]` block overrides them for light mode.

Key tokens:

```css
--bg, --surface, --surface2   background layers
--accent                       #e94560  red (selection ring, logo)
--accent2                      #533483  purple (drag-over, resize hover)
--text, --text-dim             foreground text
--border, --cell-border        structural borders
--cell-bg, --cell-bg-hover, --cell-bg-selected
--editor-bg                    textarea background
--code-bg, --pre-bg            code/pre block backgrounds
--link-color, --strong-color, --em-color
```

When a cell has `cellColor` set, its outer `div` receives inline style overrides for `--text`, `--text-dim`, `--strong-color`, `--em-color`, `--link-color`, `--code-bg`, `--pre-bg` — all set to near-black values, scoping the override to that cell's subtree only.

---

## Electron Integration

`electron/main.ts`:
- In dev (`!app.isPackaged`): loads `http://localhost:5173`.
- In production: loads `dist/index.html` (relative — `base: './'` in Vite config is critical).
- `preload.ts` exposes `window.texelAPI.platform` via `contextBridge`. Currently unused by the renderer.

Build command: `npm run electron:build` → uses `electron-builder`, outputs to `release/`.

---

## Adding Features — Where to Touch

| Feature | Files to modify |
|---------|-----------------|
| New cell formatting (checkboxes, tables) | `src/components/Cell.tsx` (view render), `src/index.css` (`.md-rendered` styles) |
| New toolbar action | `src/components/Toolbar.tsx` (add button + prop), `src/App.tsx` (add handler) |
| New export format | Create `src/utils/exportXYZ.ts`, add button in `Toolbar`, wire handler in `App.tsx` |
| Persist to localStorage | `src/hooks/useGrid.ts` — add `useEffect` saving on change, load in initialiser |
| Undo/redo | Replace `useState<GridState>` in `useGrid.ts` with a history stack (`past[]`, `present`, `future[]`) |
| Native file dialogs (Electron) | `electron/main.ts` (ipcMain.handle + dialog.showSaveDialog), `electron/preload.ts` (contextBridge), `src/utils/fileIO.ts` (detect `window.texelAPI` and branch) |
| Virtualised rendering | Wrap Grid's row/col loops with `@tanstack/react-virtual` |
| Font size / bold per cell | Add `fontSize?: number; bold?: boolean` to `CellData`, apply as inline style and pass to Cell |

---

## Conventions

- **Cell keys** are always `"${row}-${col}"` strings. Never construct them manually — use `cellKey(row, col)` from `src/types/index.ts`.
- **Empty cells with no colour are absent** from `grid.cells`. Cells with a colour but no content are kept so the colour is not lost.
- **Row/column sizes are sparse** — always use `getRowHeight(r)` / `getColWidth(c)` hooks (which apply defaults) rather than reading `grid.rowHeights[r]` directly.
- **No global store** — state flows from `App.tsx` down via props.
- **Exports are stateless utilities** — they receive `GridState` and produce a download. No React hooks.
- **TypeScript strict mode** — all new code must compile with zero errors. Run `npx tsc --noEmit` to verify.
- **SVG fill precedence** — in SVG, CSS properties beat presentation attributes. Never add `fill` to the `.cell-bg` CSS class; use the inline `fill` attribute exclusively.

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
- The grid renders all rows and columns in the DOM (no virtualisation). For very large grids (>100 rows × >50 cols with content), consider `@tanstack/react-virtual`.
- Electron native file dialogs are not yet implemented — the app uses browser-based file input and Blob download in both web and desktop modes.
- Undo/redo is not implemented.
- Column width changes do not trigger re-layout in the `<table>` until the next React render. This is by design — React drives widths via inline styles.


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

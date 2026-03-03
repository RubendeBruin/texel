import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDraggable, useDroppable } from '@dnd-kit/core';

// Reusable canvas for text measurement (created once)
let _canvas: HTMLCanvasElement | null = null;
function measureLineWidth(text: string): number {
  if (!_canvas) _canvas = document.createElement('canvas');
  const ctx = _canvas.getContext('2d')!;
  ctx.font = "13px 'Fira Code', 'Cascadia Code', Consolas, monospace";
  return ctx.measureText(text).width;
}

// Safe protocols allowed in markdown links
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'ftp:'];
function isSafeHref(href?: string): boolean {
  if (!href) return false;
  try {
    return SAFE_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false; // relative URLs or unparseable hrefs
  }
}

// Custom link renderer — opens links in a new tab and sanitizes href
const mdComponents = {
  a: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    isSafeHref(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ) : (
      <span>{children}</span>
    ),
};

const H_PAD = 28; // horizontal padding + drag handle clearance
const V_PAD = 20; // top + bottom padding
const MIN_W = 80;
const MAX_W = 600;
const MIN_H = 40;
const MAX_H = 800;

interface CellProps {
  row: number;
  col: number;
  width: number;
  height: number;
  content: string;
  cellColor?: string;
  isSelected: boolean;
  onSelect: (row: number, col: number, extend?: boolean) => void;
  onContentChange: (row: number, col: number, content: string) => void;
  onResizeRow: (row: number, height: number) => void;
  onResizeCol: (col: number, width: number) => void;
  /** When true, the cell should immediately enter edit mode (then call onAutoEditHandled). */
  autoEdit: boolean;
  onAutoEditHandled: () => void;
  onEditEnd: () => void;
}

export const Cell: React.FC<CellProps> = ({
  row,
  col,
  width,
  height,
  content,
  isSelected,
  onSelect,
  onContentChange,
  onResizeRow,
  onResizeCol,
  cellColor,
  autoEdit,
  onAutoEditHandled,
  onEditEnd,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = `cell-${row}-${col}`;

  // DnD - draggable
  const {
    attributes: dragAttrs,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id,
    data: { row, col },
    disabled: editing,
  });

  // DnD - droppable
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${row}-${col}`,
    data: { row, col },
  });

  // Combined ref
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  // Sync draft when content changes externally
  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  // Enter-edit trigger from Grid keyboard navigation.
  // autoEdit is true only for the single render where Enter was pressed;
  // we call onAutoEditHandled() immediately so the parent resets it to false.
  useEffect(() => {
    if (autoEdit) {
      setEditing(true);
      setDraft(content);
      onAutoEditHandled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  // Focus editor when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(row, col);
    setEditing(true);
    setDraft(content);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(row, col, e.shiftKey);
  };

  const commitEdit = useCallback(() => {
    setEditing(false);
    onContentChange(row, col, draft);
    // Note: blur-triggered commit intentionally does NOT call onEditEnd
    // so focus stays wherever the user clicked.
  }, [draft, onContentChange, row, col]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setDraft(content);
      onEditEnd();
    }
    // Shift+Enter = new line (default). Ctrl+Enter = commit.
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter') {
      e.preventDefault();
      setEditing(false);
      onContentChange(row, col, draft);
      onEditEnd();
    }
    // Ctrl+B — bold: wrap selection or insert empty bold markers
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const selected = draft.slice(start, end);
      const newDraft = draft.slice(0, start) + '**' + selected + '**' + draft.slice(end);
      setDraft(newDraft);
      // Place cursor inside markers when nothing selected, or after closing ** when text selected
      const newCursor = selected.length === 0 ? start + 2 : end + 4;
      requestAnimationFrame(() => {
        ta.setSelectionRange(newCursor, newCursor);
      });
    }
  };

  const hasContent = !!content.trim();

  const borderColor = isOver
    ? 'var(--accent)'
    : isSelected
    ? 'var(--accent2)'
    : 'var(--cell-border)';

  // When a cell has a custom background colour, use box-shadow overlay
  // for selection rather than changing the background.
  const boxShadow = isSelected && cellColor ? 'inset 0 0 0 2px var(--accent2)' : undefined;

  // Resolved background
  const bgColor = isOver
    ? 'rgba(83,52,131,0.3)'
    : cellColor ?? (isSelected ? 'var(--cell-bg-selected)' : 'var(--cell-bg)');

  // When a custom colour is applied, force all text to near-black regardless of theme.
  const colorOverride = cellColor ? {
    '--text': '#111',
    '--text-dim': '#555',
    '--strong-color': '#000',
    '--em-color': '#222',
    '--link-color': '#0055aa',
    '--code-bg': 'rgba(0,0,0,0.10)',
    '--pre-bg': 'rgba(0,0,0,0.10)',
  } as React.CSSProperties : {};

  return (
    <div
      ref={setRefs}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width,
        height,
        flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        boxShadow,
        position: 'relative',
        overflow: 'hidden',
        cursor: editing ? 'text' : isDragging ? 'grabbing' : 'default',
        opacity: isDragging ? 0.4 : 1,
        userSelect: editing ? 'text' : 'none',
        transition: 'background 0.1s, border-color 0.1s',
        ...colorOverride,
      }}
    >
      {/* Drag handle — only shown when content exists and not editing */}
      {hasContent && !editing && (
        <div
          title="Drag to move"
          {...dragAttrs}
          {...dragListeners}
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 14,
            height: 14,
            cursor: 'grab',
            opacity: 0.35,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 10,
                height: 2,
                background: 'var(--text-dim)',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          className="cell-editor"
          value={draft}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);

            // --- live row height ---
            // Temporarily collapse height so scrollHeight reflects true content height
            const ta = e.target;
            const prevH = ta.style.height;
            ta.style.height = 'auto';
            const naturalH = Math.min(MAX_H, Math.max(MIN_H, height, ta.scrollHeight + V_PAD));
            ta.style.height = prevH; // restore until React re-renders with new height
            if (naturalH !== height) onResizeRow(row, naturalH);

            // --- live col width ---
            const longestLine = value.split('\n').reduce<number>((max, line) => {
              const w = measureLineWidth(line) + H_PAD;
              return w > max ? w : max;
            }, MIN_W);
            const clampedW = Math.min(MAX_W, Math.max(MIN_W, width, longestLine));
            if (clampedW !== width) onResizeCol(col, clampedW);
          }}
          placeholder="Type Markdown here…&#10;&#10;Ctrl+Enter, Shift+Enter, or click outside to confirm"
          style={{ width, height, ...(cellColor ? { background: cellColor, color: '#111' } : {}) }}
        />
      ) : (
        <div
          className="md-rendered"
          style={{
            padding: '6px 8px',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            fontSize: 13,
            lineHeight: 1.5,
            color: hasContent ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {hasContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >{content}</ReactMarkdown>
          ) : (
            <span style={{ opacity: 0.3, fontSize: 11 }}>double-click to edit</span>
          )}
        </div>
      )}
    </div>
  );
};

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
  isSelected: boolean;
  onSelect: (row: number, col: number) => void;
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
    onSelect(row, col);
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
      onEditEnd(); // return focus to grid for arrow-key navigation
    }
    // Shift+Enter = new line (default). Ctrl+Enter = commit.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setEditing(false);
      onContentChange(row, col, draft);
      onEditEnd(); // return focus to grid for arrow-key navigation
    }
  };

  const hasContent = !!content.trim();

  const borderColor = isOver
    ? 'var(--accent)'
    : isSelected
    ? 'var(--accent2)'
    : 'var(--cell-border)';

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
        background: isOver
          ? 'rgba(83,52,131,0.3)'
          : isSelected
          ? 'var(--cell-bg-selected)'
          : 'var(--cell-bg)',
        position: 'relative',
        overflow: 'hidden',
        cursor: editing ? 'text' : isDragging ? 'grabbing' : 'default',
        opacity: isDragging ? 0.4 : 1,
        userSelect: editing ? 'text' : 'none',
        transition: 'background 0.1s, border-color 0.1s',
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
            const naturalH = Math.min(MAX_H, Math.max(MIN_H, ta.scrollHeight + V_PAD));
            ta.style.height = prevH; // restore until React re-renders with new height
            if (naturalH !== height) onResizeRow(row, naturalH);

            // --- live col width ---
            const longestLine = value.split('\n').reduce<number>((max, line) => {
              const w = measureLineWidth(line) + H_PAD;
              return w > max ? w : max;
            }, MIN_W);
            const clampedW = Math.min(MAX_W, Math.max(MIN_W, longestLine));
            if (clampedW !== width) onResizeCol(col, clampedW);
          }}
          placeholder="Type Markdown here…&#10;&#10;Ctrl+Enter or click outside to confirm"
          style={{ width, height }}
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <span style={{ opacity: 0.3, fontSize: 11 }}>double-click to edit</span>
          )}
        </div>
      )}
    </div>
  );
};

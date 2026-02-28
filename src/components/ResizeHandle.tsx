import React, { useCallback, useRef } from 'react';

interface ColResizeHandleProps {
  col: number;
  onResize: (col: number, newWidth: number) => void;
  currentWidth: number;
}

export const ColResizeHandle: React.FC<ColResizeHandleProps> = ({ col, onResize, currentWidth }) => {
  const startXRef = useRef(0);
  const startWRef = useRef(currentWidth);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWRef.current = currentWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        onResize(col, Math.max(80, startWRef.current + delta));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [col, currentWidth, onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize column"
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: 5,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 10,
        background: 'transparent',
      }}
      onMouseOver={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--accent2)')}
      onMouseOut={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
    />
  );
};

interface RowResizeHandleProps {
  row: number;
  onResize: (row: number, newHeight: number) => void;
  currentHeight: number;
}

export const RowResizeHandle: React.FC<RowResizeHandleProps> = ({ row, onResize, currentHeight }) => {
  const startYRef = useRef(0);
  const startHRef = useRef(currentHeight);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startYRef.current = e.clientY;
      startHRef.current = currentHeight;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startYRef.current;
        onResize(row, Math.max(40, startHRef.current + delta));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [row, currentHeight, onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize row"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: 5,
        cursor: 'row-resize',
        zIndex: 10,
        background: 'transparent',
      }}
      onMouseOver={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'var(--accent2)')}
      onMouseOut={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
    />
  );
};

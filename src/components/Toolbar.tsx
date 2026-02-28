import React, { useRef } from 'react';

interface ToolbarProps {
  title: string;
  onTitleChange: (t: string) => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const btn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 5,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  transition: 'background 0.15s, border-color 0.15s',
};

const accentBtn: React.CSSProperties = {
  ...btn,
  background: 'var(--accent2)',
  border: '1px solid var(--accent2)',
  color: '#fff',
};

export const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  onNew,
  onSave,
  onLoad,
  onExportSVG,
  onExportPDF,
  theme,
  onToggleTheme,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        height: 'var(--toolbar-h)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* App icon / title */}
      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)', letterSpacing: 2, marginRight: 4 }}>
        TEXEL
      </span>

      {/* Document title */}
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 13,
          padding: '2px 6px',
          width: 180,
          outline: 'none',
        }}
        placeholder="Untitled"
        title="Document title"
      />

      <div style={{ flex: 1 }} />

      {/* File operations */}
      <button style={btn} onClick={onNew} title="New document">New</button>
      <button style={btn} onClick={onLoad} title="Open .texel or .json file">Open</button>
      <button style={accentBtn} onClick={onSave} title="Save as .texel (JSON)">Save JSON</button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* Export */}
      <button style={btn} onClick={onExportSVG} title="Export grid as SVG (light theme)">Export SVG</button>
      <button style={btn} onClick={onExportPDF} title="Export grid as PDF (light theme)">Export PDF</button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      {/* Theme toggle */}
      <button
        style={{ ...btn, fontSize: 16, padding: '2px 8px', letterSpacing: 0 }}
        onClick={onToggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Info */}
      <div
        style={{
          marginLeft: 8,
          fontSize: 10,
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
        }}
      >
        Double-click cell to edit · Ctrl+Enter to save · Drag handle to move
      </div>
    </div>
  );
};

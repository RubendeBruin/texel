import React from 'react';

interface ToolbarProps {
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onAutoFit: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  // fill controls
  selCount: number;
  fillColor: string;
  onFillColorChange: (c: string) => void;
  onSwatchApply: (color: string) => void;
  onApplyFill: () => void;
  onClearFill: () => void;
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

const SWATCHES = [
  { color: '#ffe033', title: 'Yellow' },
  { color: '#4cdb6a', title: 'Green' },
  { color: '#3aaeef', title: 'Blue' },
  { color: '#f25c5c', title: 'Red' },
  { color: '#ff8c2a', title: 'Orange' },
  { color: '#b35cf2', title: 'Purple' },
  { color: '#1fdbb5', title: 'Mint' },
  { color: '#c0c0c0', title: 'Grey' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  onNew,
  onSave,
  onLoad,
  onExportSVG,
  onExportPDF,
  onAutoFit,
  theme,
  onToggleTheme,
  selCount,
  fillColor,
  onFillColorChange,
  onSwatchApply,
  onApplyFill,
  onClearFill,
}) => (
  <div
    style={{
      height: 'var(--toolbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '0 12px',
      flexShrink: 0,
      userSelect: 'none',
      overflowX: 'auto',
    }}
  >
    {/* File operations */}
    <button style={btn} onClick={onNew} title="New document">New</button>
    <button style={btn} onClick={onLoad} title="Open .texel or .json file">Open</button>
    <button style={accentBtn} onClick={onSave} title="Save as .texel (JSON)">Save</button>

    <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

    <button style={btn} onClick={onAutoFit} title="Auto-size all rows and columns to fit their contents">Auto-fit</button>
    <button style={btn} onClick={onExportSVG} title="Export grid as SVG">SVG</button>
    <button style={btn} onClick={onExportPDF} title="Export grid as PDF">PDF</button>

    <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

    <button
      style={{ ...btn, fontSize: 15, padding: '2px 8px' }}
      onClick={onToggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>

    {/* Fill controls — shown when cells are selected */}
    {selCount > 0 && (
      <>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Fill:</span>
        {SWATCHES.map(({ color, title }) => (
          <button
            key={color}
            title={title}
            onClick={() => onSwatchApply(color)}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              background: color,
              border: fillColor === color ? '2px solid var(--accent)' : '1px solid #aaa',
              borderRadius: 3,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}
        <input
          type="color"
          value={fillColor}
          onChange={(e) => onFillColorChange(e.target.value)}
          style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none', flexShrink: 0 }}
          title="Custom colour"
        />
        <button
          onClick={onApplyFill}
          style={{ fontSize: 12, padding: '2px 8px', background: fillColor, color: '#111', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
        >
          Apply
        </button>
        <button
          onClick={onClearFill}
          style={{ ...btn, flexShrink: 0 }}
        >
          Clear
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
          {selCount} cell{selCount !== 1 ? 's' : ''}
        </span>
      </>
    )}
  </div>
);

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar';
import { Grid } from './components/Grid';
import { useGrid } from './hooks/useGrid';
import { gridToJson, jsonToGrid, saveFileAuto, openFileAuto } from './utils/fileIO';
import { exportToSVG } from './utils/exportSVG';
import { exportToPDF } from './utils/exportPDF';
import { computeAutoColWidths, computeAutoRowHeights } from './utils/autoFit';

type Theme = 'dark' | 'light';

function App() {
  const [title, setTitle] = useState('Untitled');
  const [theme, setTheme] = useState<Theme>('light');
  const [fillColor, setFillColor] = useState('#ffd700');
  const [selectedPositions, setSelectedPositions] = useState<{ row: number; col: number }[]>([]);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);
  const {
    grid,
    getCell,
    setCell,
    moveCell,
    getRowHeight,
    getColWidth,
    setRowHeight,
    setColWidth,
    setAllColWidths,
    setAllRowHeights,
    setCellColors,
    insertRow,
    deleteRow,
    insertCol,
    deleteCol,
    expandGrid,
    loadGrid,
    clearGrid,
  } = useGrid();

  const handleNew = useCallback(() => {
    if (confirm('Start a new document? Unsaved changes will be lost.')) {
      clearGrid();
      setTitle('Untitled');
    }
  }, [clearGrid]);

  const handleSelectionChange = useCallback((positions: { row: number; col: number }[]) => {
    setSelectedPositions(positions);
  }, []);

  const handleSwatchApply = useCallback((color: string) => {
    setFillColor(color);
    if (selectedPositions.length > 0) setCellColors(selectedPositions, color);
  }, [selectedPositions, setCellColors]);

  const handleApplyFill = useCallback(() => {
    if (selectedPositions.length > 0) setCellColors(selectedPositions, fillColor);
  }, [selectedPositions, fillColor, setCellColors]);

  const handleClearFill = useCallback(() => {
    if (selectedPositions.length > 0) setCellColors(selectedPositions, undefined);
  }, [selectedPositions, setCellColors]);

  const handleSave = useCallback(async () => {
    const json = gridToJson(grid, title);
    const usedPath = await saveFileAuto(json, title, lastFilename);
    if (usedPath) setLastFilename(usedPath);
  }, [grid, title, lastFilename]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await openFileAuto();
      if (!result) return;
      const file = jsonToGrid(result.content);
      loadGrid(file.grid);
      const loadedTitle = file.metadata.title || 'Untitled';
      setTitle(loadedTitle);
      if (result.filePath) {
        setLastFilename(result.filePath);
      } else {
        setLastFilename(`${loadedTitle}.texel`);
      }
    } catch (e) {
      alert('Failed to open file: ' + (e as Error).message);
    }
  }, [loadGrid]);

  // Ctrl+S global shortcut — save using last filename
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleExportSVG = useCallback(() => {
    exportToSVG(grid, title || 'texel');
  }, [grid, title]);

  const handleExportPDF = useCallback(() => {
    exportToPDF(grid, title || 'texel');
  }, [grid, title]);

  const handleAutoFit = useCallback(() => {
    const newColWidths = computeAutoColWidths(grid);
    // Use the freshly computed widths (not yet in state) for row height measurement
    const mergedColWidths = { ...grid.colWidths, ...newColWidths };
    const newRowHeights = computeAutoRowHeights(grid, mergedColWidths);
    setAllColWidths(newColWidths);
    setAllRowHeights(newRowHeights);
  }, [grid, setAllColWidths, setAllRowHeights]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <Toolbar
        onNew={handleNew}
        onSave={handleSave}
        onLoad={handleLoad}
        onExportSVG={handleExportSVG}
        onExportPDF={handleExportPDF}
        onAutoFit={handleAutoFit}
        theme={theme}
        onToggleTheme={toggleTheme}
        selCount={selectedPositions.length}
        fillColor={fillColor}
        onFillColorChange={setFillColor}
        onSwatchApply={handleSwatchApply}
        onApplyFill={handleApplyFill}
        onClearFill={handleClearFill}
      />
      <Grid
        numRows={grid.numRows}
        numCols={grid.numCols}
        getCell={getCell}
        setCell={setCell}
        moveCell={moveCell}
        getRowHeight={getRowHeight}
        getColWidth={getColWidth}
        setRowHeight={setRowHeight}
        setColWidth={setColWidth}
        setCellColors={setCellColors}
        insertRow={insertRow}
        deleteRow={deleteRow}
        insertCol={insertCol}
        deleteCol={deleteCol}
        expandGrid={expandGrid}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}

export default App;
